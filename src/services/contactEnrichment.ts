/**
 * Servicio de Enriquecimiento Nivel 2 (Google / Doctoralia / Directorios Médicos)
 * Busca automáticamente teléfonos, WhatsApp, nombre real del médico y consultorio
 * a partir de la web abierta y perfiles públicos de Doctoralia.
 */

export interface EnrichmentResult {
  success: boolean;
  query: string;
  found: boolean;
  doctor_name?: string;
  phone?: string;
  whatsapp?: string;
  title?: string;
  city?: string;
  address?: string;
  source_url?: string;
  google_search_url: string;
  doctoralia_search_url: string;
  raw_snippet?: string;
  error?: string;
}

export function cleanMexicanPhone(raw: string): { phone: string; whatsapp: string } | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  // Si viene con prefijo internacional 52 (ej. 529994891040 o 5219994891040)
  if (digits.startsWith("521") && digits.length === 13) {
    digits = digits.slice(3);
  } else if (digits.startsWith("52") && digits.length === 12) {
    digits = digits.slice(2);
  }
  if (digits.length === 10) {
    return {
      phone: digits,
      whatsapp: `+52${digits}`,
    };
  }
  return null;
}

export function extractDoctorSearchTerm(name?: string, accountName?: string): string {
  const isGeneric = (str?: string) =>
    !str ||
    str === "-" ||
    str.toLowerCase().includes("sin nombre") ||
    str.toLowerCase().includes("contacto corporativo");

  if (!isGeneric(name)) {
    return name!.trim();
  }

  if (!isGeneric(accountName)) {
    // Si la cuenta dice "CONSULTORIO ONCOLOGICO YAIR BENJAMIN BAAS CABRERA"
    return accountName!.trim();
  }

  return "";
}

export async function enrichDoctorLead(params: {
  name?: string;
  accountName?: string;
  city?: string;
}): Promise<EnrichmentResult> {
  const searchTerm = extractDoctorSearchTerm(params.name, params.accountName);
  const city = (params.city && params.city !== "-") ? params.city : "";
  const query = `${searchTerm} ${city} doctoralia mexico`.trim();

  const google_search_url = `https://www.google.com/search?q=${encodeURIComponent(`${searchTerm} ${city} telefono whatsapp`.trim())}`;
  const doctoralia_search_url = `https://www.doctoralia.com.mx/buscar?q=${encodeURIComponent(searchTerm)}`;

  if (!searchTerm) {
    return {
      success: false,
      query: "",
      found: false,
      google_search_url,
      doctoralia_search_url,
      error: "No hay nombre ni cuenta suficiente para buscar.",
    };
  }

  try {
    // 1. Consultar motor público para localizar perfil Doctoralia / Redes
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!searchRes.ok) {
      return {
        success: true,
        query,
        found: false,
        google_search_url,
        doctoralia_search_url,
        error: `Búsqueda respondió status ${searchRes.status}`,
      };
    }

    const searchHtml = await searchRes.text();

    // Extraer URLs de Doctoralia del resultado
    const docRegex = /href="[^"]*(https:\/\/www\.doctoralia\.com\.mx\/[a-z0-9\-_/]+)"/gi;
    let match;
    let doctoraliaProfileUrl = "";
    while ((match = docRegex.exec(searchHtml)) !== null) {
      const url = match[1];
      if (url.includes("/perfil/") || (url.split("/").length >= 5 && !url.includes("/buscar"))) {
        doctoraliaProfileUrl = url;
        break;
      }
    }

    // Snippets para contexto
    const snippetMatch = searchHtml.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
    const rawSnippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, "").trim() : "";

    let doctorName: string | undefined;
    let foundPhone: string | undefined;
    let foundWa: string | undefined;
    let foundTitle: string | undefined;
    let foundAddress: string | undefined;

    // Si encontramos perfil en Doctoralia, obtener teléfono y datos precisos
    if (doctoraliaProfileUrl) {
      try {
        const profileRes = await fetch(doctoraliaProfileUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          redirect: "follow",
        });

        if (profileRes.ok) {
          const profileHtml = await profileRes.text();

          // 1. JSON-LD Schema
          const jsonLdRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
          let jm;
          while ((jm = jsonLdRegex.exec(profileHtml)) !== null) {
            try {
              const parsed = JSON.parse(jm[1]);
              if (parsed["@type"] === "Physician" || parsed["@type"] === "MedicalBusiness" || parsed["@type"] === "Person") {
                if (parsed.name && !doctorName) doctorName = parsed.name;
                if (parsed.medicalSpecialty && !foundTitle) foundTitle = String(parsed.medicalSpecialty);
                if (parsed.telephone && !foundPhone) {
                  const cleaned = cleanMexicanPhone(parsed.telephone);
                  if (cleaned) {
                    foundPhone = cleaned.phone;
                    foundWa = cleaned.whatsapp;
                  }
                }
              }
            } catch {
              // Ignore JSON parse errors in individual scripts
            }
          }

          // 2. Extraer teléfono de atributos de Doctoralia
          // ej: data-target="[data-id='address-148823-9994891040-secretary-ai-phone"
          if (!foundPhone) {
            const phoneAttrMatch = profileHtml.match(/address-\d+-([1-9]\d{9})-secretary/);
            if (phoneAttrMatch) {
              const cleaned = cleanMexicanPhone(phoneAttrMatch[1]);
              if (cleaned) {
                foundPhone = cleaned.phone;
                foundWa = cleaned.whatsapp;
              }
            }
          }

          // 3. Extraer teléfono de patrones 10 dígitos dentro de bloques de contacto
          if (!foundPhone) {
            const rawPhones = [...profileHtml.matchAll(/(?:tel:|data-phone="|phone">|\b)(?:\+?52\s?)?([1-9]\d{9})\b/g)].map((m) => m[1]);
            // Filtrar números que parezcan válidos
            for (const rp of rawPhones) {
              // evitar códigos de analytics o timestamps
              if (!rp.startsWith("179") && !rp.startsWith("226") && !rp.startsWith("316")) {
                const cleaned = cleanMexicanPhone(rp);
                if (cleaned) {
                  foundPhone = cleaned.phone;
                  foundWa = cleaned.whatsapp;
                  break;
                }
              }
            }
          }

          // Extraer dirección / ciudad
          const streetMatch = profileHtml.match(/itemprop="streetAddress">([^<]+)</);
          const localityMatch = profileHtml.match(/itemprop="addressLocality">([^<]+)</);
          if (streetMatch || localityMatch) {
            foundAddress = [streetMatch?.[1]?.trim(), localityMatch?.[1]?.trim()].filter(Boolean).join(", ");
          }

          // Extraer especialidad si no se encontró
          if (!foundTitle) {
            const specMatch = profileHtml.match(/<span[^>]*class="[^"]*text-muted[^"]*"[^>]*>([^<]*(?:Oncól|Cirug|Médic|Dentist|Oftalm|Pediatr|Ginecol|Cardiól)[^<]*)<\/span>/i);
            if (specMatch) foundTitle = specMatch[1].trim();
          }
        }
      } catch {
        // Fallback a snippets
      }
    }

    // Fallback: Si no hay teléfono de Doctoralia, buscar en el snippet general
    if (!foundPhone && rawSnippet) {
      const snippetPhoneMatch = rawSnippet.match(/(?:\+?52\s?)?([1-9]\d{9})\b/);
      if (snippetPhoneMatch) {
        const cleaned = cleanMexicanPhone(snippetPhoneMatch[1]);
        if (cleaned) {
          foundPhone = cleaned.phone;
          foundWa = cleaned.whatsapp;
        }
      }
    }

    const hasAnyData = !!(foundPhone || foundWa || doctorName || doctoraliaProfileUrl);

    return {
      success: true,
      query,
      found: hasAnyData,
      doctor_name: doctorName || (searchTerm.startsWith("Dr.") ? searchTerm : undefined),
      phone: foundPhone,
      whatsapp: foundWa,
      title: foundTitle,
      address: foundAddress,
      city: params.city || undefined,
      source_url: doctoraliaProfileUrl || undefined,
      google_search_url,
      doctoralia_search_url,
      raw_snippet: rawSnippet || undefined,
    };
  } catch (err: any) {
    return {
      success: false,
      query,
      found: false,
      google_search_url,
      doctoralia_search_url,
      error: err?.message || "Error en proceso de enriquecimiento",
    };
  }
}
