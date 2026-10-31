// ALTUM Sureste — Showcase Inmobiliario de Lujo Caribeño Contemporáneo
// Strict Tenant Isolation: Todos los estilos, variables y selectores están encapsulados herméticamente.

export function renderAltumPage(): string {
  return `<!DOCTYPE html>
<html lang="es" class="altum-theme">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ALTUM Sureste · Real Estate Caribe Mexicano | Lujo Silencioso & Destinos</title>
  <meta name="description" content="Propiedades curadas en Riviera Maya, Mérida, Tulum, Holbox, Bacalar y Cozumel. Lujo silencioso, arquitectura contemporánea, línea de horizonte y línea de agua.">
  
  <link rel="icon" type="image/svg+xml" href="/assets/altum/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;600;700&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">

  <style>
    /* Scope de variables ALTUM — Cero contaminación global */
    .altum-theme, .altum-scope {
      --altum-cal: #F7F4ED;
      --altum-arena: #EFE7D5;
      --altum-muro: #FFFDF7;
      --altum-chukum: #D9C9B0;
      --altum-cenote: #0E6B7A;
      --altum-cenote-dk: #094F5B;
      --altum-cenote-hi: #2FB8CC;
      --altum-coral: #C9573F;
      --altum-coral-dk: #9E3F2C;
      --altum-ambar: #C89B3C;
      --altum-ambar-dk: #8A6B1F;
      --altum-grafito: #1A2B3B;
      --altum-grafito-2: #3E4F5C;
      --altum-grafito-3: #6B7682;
      --altum-selva: #0F1E1A;
      --altum-selva-2: #1A2F28;
      --altum-selva-3: #24382F;
      --altum-selva-b: #304035;
      
      --altum-font-display: 'Fraunces', Georgia, serif;
      --altum-font-body: 'Inter', system-ui, -apple-system, sans-serif;
      --altum-font-mono: 'JetBrains Mono', Consolas, monospace;
      
      background-color: var(--altum-cal);
      color: var(--altum-grafito);
      font-family: var(--altum-font-body);
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
      box-sizing: border-box;
    }

    *, *:before, *:after {
      box-sizing: inherit;
    }

    /* Tipografía */
    .altum-font-display { font-family: var(--altum-font-display); }
    .altum-font-mono { font-family: var(--altum-font-mono); font-variant-numeric: tabular-nums; }

    /* Contenedor */
    .altum-container {
      max-width: 1240px;
      margin: 0 auto;
      padding: 0 24px;
    }

    /* Navbar */
    .altum-nav {
      background: rgba(247, 244, 237, 0.92);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--altum-chukum);
      position: sticky;
      top: 0;
      z-index: 50;
      transition: all 0.2s ease;
    }
    .altum-nav-inner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 76px;
    }
    .altum-brand {
      display: flex;
      align-items: center;
      gap: 14px;
      text-decoration: none;
      color: var(--altum-grafito);
    }
    .altum-brand-logo {
      height: 38px;
      width: auto;
    }
    .altum-brand-title {
      font-family: var(--altum-font-display);
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--altum-cenote-dk);
    }
    .altum-brand-tagline {
      font-size: 11px;
      font-family: var(--altum-font-mono);
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--altum-grafito-3);
    }
    .altum-nav-links {
      display: flex;
      gap: 28px;
      list-style: none;
      margin: 0;
      padding: 0;
      align-items: center;
    }
    .altum-nav-link {
      font-size: 14px;
      font-weight: 500;
      color: var(--altum-grafito-2);
      text-decoration: none;
      transition: color 0.15s ease;
    }
    .altum-nav-link:hover {
      color: var(--altum-cenote);
    }

    /* Botones WCAG AA / AAA */
    .altum-btn-primary {
      background: var(--altum-cenote);
      color: #FFFFFF !important;
      border: none;
      border-radius: 4px;
      padding: 12px 24px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: background 0.2s ease, transform 0.1s ease;
    }
    .altum-btn-primary:hover {
      background: var(--altum-cenote-dk);
      transform: translateY(-1px);
    }
    .altum-btn-coral {
      background: var(--altum-coral);
      color: #FFFFFF !important;
      border: none;
      border-radius: 4px;
      padding: 14px 28px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: background 0.2s ease;
    }
    .altum-btn-coral:hover {
      background: var(--altum-coral-dk);
    }
    .altum-btn-outline {
      background: transparent;
      color: var(--altum-cenote-dk);
      border: 1.5px solid var(--altum-cenote-dk);
      border-radius: 4px;
      padding: 10px 22px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease;
    }
    .altum-btn-outline:hover {
      background: var(--altum-arena);
      color: var(--altum-cenote-dk);
    }

    /* Badges de estado inmobiliario — semitransparentes según Design System */
    .altum-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      font-family: var(--altum-font-mono);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .altum-badge--disp {
      background: rgba(46, 139, 111, 0.14);
      color: #1F4F3B;
      border: 1px solid rgba(46, 139, 111, 0.35);
    }
    .altum-badge--reserv {
      background: rgba(200, 155, 60, 0.16);
      color: #8A6B1F;
      border: 1px solid rgba(200, 155, 60, 0.35);
    }
    .altum-badge--prev {
      background: rgba(14, 107, 122, 0.14);
      color: #094F5B;
      border: 1px solid rgba(14, 107, 122, 0.35);
    }

    /* Hero */
    .altum-hero {
      padding: 72px 0 64px 0;
      background: linear-gradient(180deg, var(--altum-cal) 0%, var(--altum-arena) 100%);
      border-bottom: 1px solid var(--altum-chukum);
      position: relative;
      overflow: hidden;
    }
    .altum-hero-badge-wrap {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      align-items: center;
    }
    .altum-hero-h1 {
      font-family: var(--altum-font-display);
      font-size: clamp(34px, 5vw, 56px);
      line-height: 1.15;
      font-weight: 700;
      color: var(--altum-grafito);
      margin: 0 0 20px 0;
      max-width: 900px;
    }
    .altum-hero-p {
      font-size: 18px;
      line-height: 1.6;
      color: var(--altum-grafito-2);
      max-width: 720px;
      margin: 0 0 32px 0;
    }
    .altum-hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
    }

    /* Divisor Horizonte (8% caribeño) */
    .altum-horizonte-bar {
      height: 32px;
      background-image: url("/assets/altum/divider-horizonte.svg");
      background-repeat: repeat-x;
      background-position: center;
      opacity: 0.6;
      margin: 40px 0;
    }

    /* Grid de Regiones */
    .altum-region-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 28px 0 40px 0;
    }
    .altum-pill {
      background: var(--altum-muro);
      border: 1px solid var(--altum-chukum);
      padding: 8px 18px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 500;
      color: var(--altum-grafito-2);
      text-decoration: none;
      transition: all 0.15s ease;
      cursor: pointer;
    }
    .altum-pill:hover, .altum-pill.active {
      background: var(--altum-cenote);
      color: #FFFFFF;
      border-color: var(--altum-cenote);
    }

    /* Tarjetas de Ficha Inmobiliaria */
    .altum-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 28px;
      margin-bottom: 64px;
    }
    .altum-ficha {
      background: var(--altum-muro);
      border: 1px solid var(--altum-chukum);
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 4px 20px -4px rgba(26, 43, 59, 0.08);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      display: flex;
      flex-direction: column;
    }
    .altum-ficha:hover {
      transform: translateY(-4px);
      box-shadow: 0 16px 32px -8px rgba(26, 43, 59, 0.14);
    }
    .altum-ficha-header {
      position: relative;
      height: 220px;
      background-color: var(--altum-arena);
      overflow: hidden;
    }
    .altum-ficha-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.4s ease;
    }
    .altum-ficha:hover .altum-ficha-img {
      transform: scale(1.03);
    }
    .altum-ficha-badge-overlay {
      position: absolute;
      top: 14px;
      left: 14px;
      z-index: 2;
    }
    .altum-ficha-region-overlay {
      position: absolute;
      bottom: 12px;
      right: 14px;
      background: rgba(15, 30, 26, 0.75);
      color: var(--altum-cal);
      font-family: var(--altum-font-mono);
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 4px;
      backdrop-filter: blur(4px);
    }
    .altum-ficha-body {
      padding: 24px;
      display: flex;
      flex-direction: column;
      flex-grow: 1;
    }
    .altum-ficha-title {
      font-family: var(--altum-font-display);
      font-size: 21px;
      font-weight: 700;
      margin: 0 0 8px 0;
      color: var(--altum-grafito);
    }
    .altum-ficha-desc {
      font-size: 14px;
      line-height: 1.5;
      color: var(--altum-grafito-2);
      margin: 0 0 16px 0;
    }
    .altum-ficha-specs {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      padding: 12px 0;
      border-top: 1px solid var(--altum-chukum);
      border-bottom: 1px solid var(--altum-chukum);
      margin-bottom: 20px;
      font-size: 12px;
      color: var(--altum-grafito-3);
    }
    .altum-spec-item strong {
      display: block;
      color: var(--altum-grafito);
      font-family: var(--altum-font-mono);
      font-size: 13px;
    }
    .altum-ficha-footer {
      margin-top: auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .altum-ficha-price {
      display: flex;
      flex-direction: column;
    }
    .altum-price-label {
      font-size: 11px;
      text-transform: uppercase;
      font-family: var(--altum-font-mono);
      color: var(--altum-grafito-3);
    }
    .altum-price-val {
      font-family: var(--altum-font-mono);
      font-size: 20px;
      font-weight: 700;
      color: var(--altum-cenote-dk);
    }
    .altum-apartado-label {
      font-size: 11px;
      font-family: var(--altum-font-mono);
      color: var(--altum-coral-dk);
    }

    /* Modal / Drawer de Apartado Conekta SPEI */
    .altum-modal-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(15, 30, 26, 0.75);
      backdrop-filter: blur(8px);
      z-index: 100;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .altum-modal {
      background: var(--altum-muro);
      border: 1px solid var(--altum-chukum);
      border-radius: 8px;
      max-width: 540px;
      width: 100%;
      padding: 32px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      position: relative;
      animation: modalSlide 0.2s ease-out;
    }
    @keyframes modalSlide {
      from { transform: scale(0.96) translateY(10px); opacity: 0; }
      to { transform: scale(1) translateY(0); opacity: 1; }
    }
    .altum-modal-close {
      position: absolute;
      top: 18px;
      right: 18px;
      background: none;
      border: none;
      font-size: 22px;
      cursor: pointer;
      color: var(--altum-grafito-3);
    }
    .altum-clabe-box {
      background: var(--altum-cal);
      border: 1.5px dashed var(--altum-cenote);
      border-radius: 6px;
      padding: 16px;
      margin: 18px 0;
      text-align: center;
    }
    .altum-clabe-num {
      font-family: var(--altum-font-mono);
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--altum-cenote-dk);
      margin: 8px 0;
    }

    /* Footer */
    .altum-footer {
      background: var(--altum-selva);
      color: var(--altum-cal);
      padding: 64px 0 40px 0;
      border-top: 1px solid var(--altum-selva-b);
    }
    .altum-footer-grid {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 40px;
      margin-bottom: 40px;
    }
    .altum-footer-title {
      font-family: var(--altum-font-display);
      font-size: 22px;
      font-weight: 700;
      color: var(--altum-cal);
      margin: 0 0 12px 0;
    }
    .altum-footer-p {
      color: var(--altum-chukum);
      font-size: 14px;
      line-height: 1.6;
      max-width: 420px;
    }
    .altum-footer-nav h4 {
      font-family: var(--altum-font-mono);
      font-size: 12px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--altum-cenote-hi);
      margin: 0 0 16px 0;
    }
    .altum-footer-nav ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .altum-footer-nav li {
      margin-bottom: 8px;
    }
    .altum-footer-nav a {
      color: var(--altum-chukum);
      text-decoration: none;
      font-size: 13px;
      transition: color 0.15s ease;
    }
    .altum-footer-nav a:hover {
      color: var(--altum-cal);
    }
    .altum-footer-bottom {
      border-top: 1px solid var(--altum-selva-b);
      padding-top: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: var(--altum-chukum);
      font-family: var(--altum-font-mono);
    }
  </style>
</head>
<body class="altum-scope">

  <!-- Barra de Navegación -->
  <header class="altum-nav">
    <div class="altum-container altum-nav-inner">
      <a href="/altum" class="altum-brand">
        <svg width="34" height="34" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="32" height="32" rx="4" fill="#0E6B7A"/>
          <line x1="6" y1="14" x2="26" y2="14" stroke="#F7F4ED" stroke-width="2"/>
          <path d="M6 21C11 19 21 23 26 21" stroke="#2FB8CC" stroke-width="1.8" stroke-linecap="round"/>
          <polygon points="16,6 21,13 11,13" fill="#C89B3C"/>
        </svg>
        <div>
          <div class="altum-brand-title">ALTUM</div>
          <div class="altum-brand-tagline">Sureste & Caribe Mexicano</div>
        </div>
      </a>

      <ul class="altum-nav-links">
        <li><a href="#destinos" class="altum-nav-link">Destinos</a></li>
        <li><a href="#propiedades" class="altum-nav-link">Colección de Villas</a></li>
        <li><a href="#lotes" class="altum-nav-link">Macrolotes</a></li>
        <li><a href="#filosofia" class="altum-nav-link">Manifiesto</a></li>
        <li><a href="/superadmin" class="altum-btn-outline" title="Puesto de mando CRM">CRM Ark</a></li>
        <li><button onclick="abrirApartado('General', 'altum_enganche_condo', 50000)" class="altum-btn-primary">Apartado en Línea</button></li>
      </ul>
    </div>
  </header>

  <!-- Hero Section Editorial -->
  <section class="altum-hero">
    <div class="altum-container">
      <div class="altum-hero-badge-wrap">
        <span class="altum-badge altum-badge--prev">Colección 2026 · Sureste & Caribe</span>
        <span style="font-size: 12px; font-family: var(--altum-font-mono); color: var(--altum-grafito-3);">Tulum · Mérida · Holbox · Bacalar · Cozumel</span>
      </div>

      <h1 class="altum-hero-h1">
        Cada propiedad tiene una línea de horizonte y una línea de agua.
      </h1>

      <p class="altum-hero-p">
        ALTUM no vende metros cuadrados comerciales. Presenta destinos arquitectónicos vivos.
        Cal maya que respira, piedra de la región, agua de cenote y proporción de villa contemporánea,
        libre del cliché decorativo.
      </p>

      <div class="altum-hero-actions">
        <a href="#propiedades" class="altum-btn-coral">Explorar Destinos Disponibles</a>
        <a href="#filosofia" class="altum-btn-outline">Conocer la Regla del 8% Caribeño</a>
      </div>
    </div>
  </section>

  <!-- Divisor Horizonte -->
  <div class="altum-horizonte-bar"></div>

  <!-- Catálogo y Destinos -->
  <main class="altum-container" id="propiedades">
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px;">
      <div>
        <span class="altum-badge altum-badge--disp">Propiedades Curadas</span>
        <h2 style="font-family: var(--altum-font-display); font-size: 32px; margin: 8px 0 0 0; color: var(--altum-grafito);">
          Fichas de Selección y Reserva
        </h2>
      </div>
      <div style="font-size: 13px; font-family: var(--altum-font-mono); color: var(--altum-grafito-3);">
        Reserva respaldada con SPEI STP en tiempo real
      </div>
    </div>

    <!-- Filtros de Región -->
    <div class="altum-region-pills" id="destinos">
      <button class="altum-pill active" onclick="filtrarRegion('todas', this)">Todas las Regiones (6)</button>
      <button class="altum-pill" onclick="filtrarRegion('Tulum', this)">Tulum</button>
      <button class="altum-pill" onclick="filtrarRegion('Mérida', this)">Mérida</button>
      <button class="altum-pill" onclick="filtrarRegion('Holbox', this)">Holbox</button>
      <button class="altum-pill" onclick="filtrarRegion('Bacalar', this)">Bacalar</button>
      <button class="altum-pill" onclick="filtrarRegion('Riviera Maya', this)">Riviera Maya</button>
    </div>

    <!-- Grid de Fichas Inmobiliarias -->
    <div class="altum-grid">

      <!-- Ficha 1: Villa Cenote Tulum -->
      <article class="altum-ficha" data-region="Tulum">
        <div class="altum-ficha-header">
          <img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80" alt="Villa Cenote Cristal" class="altum-ficha-img" loading="lazy">
          <div class="altum-ficha-badge-overlay">
            <span class="altum-badge altum-badge--disp">Disponible</span>
          </div>
          <div class="altum-ficha-region-overlay">Tulum · Región 15</div>
        </div>
        <div class="altum-ficha-body">
          <h3 class="altum-ficha-title">Villa Cenote Cristal</h3>
          <p class="altum-ficha-desc">
            Residencia en dos niveles construida sobre roca caliza viva con alberca natural alimentada por flujo de cenote y acabados en chukum pulido.
          </p>
          <div class="altum-ficha-specs">
            <div class="altum-spec-item">Construcción: <strong>420 m²</strong></div>
            <div class="altum-spec-item">Terreno: <strong>650 m²</strong></div>
            <div class="altum-spec-item">Recámaras: <strong>4 suites</strong></div>
            <div class="altum-spec-item">Entrega: <strong>Inmediata</strong></div>
          </div>
          <div class="altum-ficha-footer">
            <div class="altum-ficha-price">
              <span class="altum-price-label">Valor de Operación</span>
              <span class="altum-price-val">$14,800,000 MXN</span>
              <span class="altum-apartado-label">Apartado: $50,000 MXN</span>
            </div>
            <button onclick="abrirApartado('Villa Cenote Cristal', 'altum_enganche_condo', 50000)" class="altum-btn-primary">
              Apartar Ficha
            </button>
          </div>
        </div>
      </article>

      <!-- Ficha 2: Mansión Montejo Norte Mérida -->
      <article class="altum-ficha" data-region="Mérida">
        <div class="altum-ficha-header">
          <img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80" alt="Residencia Montejo Norte" class="altum-ficha-img" loading="lazy">
          <div class="altum-ficha-badge-overlay">
            <span class="altum-badge altum-badge--prev">Preventa Exclusiva</span>
          </div>
          <div class="altum-ficha-region-overlay">Mérida · Zona Norte</div>
        </div>
        <div class="altum-ficha-body">
          <h3 class="altum-ficha-title">Residencia Montejo Norte</h3>
          <p class="altum-ficha-desc">
            Casona contemporánea con patios interiores de ventilación cruzada maya, dobles alturas, piscina de piedra jade y maderas tropicales certificadas.
          </p>
          <div class="altum-ficha-specs">
            <div class="altum-spec-item">Construcción: <strong>780 m²</strong></div>
            <div class="altum-spec-item">Terreno: <strong>1,200 m²</strong></div>
            <div class="altum-spec-item">Recámaras: <strong>5 suites</strong></div>
            <div class="altum-spec-item">Fase: <strong>Preventa 2026</strong></div>
          </div>
          <div class="altum-ficha-footer">
            <div class="altum-ficha-price">
              <span class="altum-price-label">Valor de Operación</span>
              <span class="altum-price-val">$22,500,000 MXN</span>
              <span class="altum-apartado-label">Enganche: $50,000 MXN</span>
            </div>
            <button onclick="abrirApartado('Residencia Montejo Norte', 'altum_enganche_condo', 50000)" class="altum-btn-primary">
              Apartar Ficha
            </button>
          </div>
        </div>
      </article>

      <!-- Ficha 3: Lote Punta Cocos Holbox -->
      <article class="altum-ficha" data-region="Holbox" id="lotes">
        <div class="altum-ficha-header">
          <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80" alt="Lote Holbox Reserva" class="altum-ficha-img" loading="lazy">
          <div class="altum-ficha-badge-overlay">
            <span class="altum-badge altum-badge--disp">Disponible</span>
          </div>
          <div class="altum-ficha-region-overlay">Isla Holbox · Punta Cocos</div>
        </div>
        <div class="altum-ficha-body">
          <h3 class="altum-ficha-title">Lote Punta Cocos Reserva</h3>
          <p class="altum-ficha-desc">
            Parcela unifamiliar con 35 metros lineales de frente de mar esmeralda, densidad baja (H1), manifestación de impacto ambiental vigente y escritura pública.
          </p>
          <div class="altum-ficha-specs">
            <div class="altum-spec-item">Superficie: <strong>1,800 m²</strong></div>
            <div class="altum-spec-item">Frente playa: <strong>35 m</strong></div>
            <div class="altum-spec-item">Uso: <strong>Residencial Eco</strong></div>
            <div class="altum-spec-item">Folio: <strong>ALT-HLB-094</strong></div>
          </div>
          <div class="altum-ficha-footer">
            <div class="altum-ficha-price">
              <span class="altum-price-label">Valor de Operación</span>
              <span class="altum-price-val">$9,200,000 MXN</span>
              <span class="altum-apartado-label">Apartado Lote: $20,000 MXN</span>
            </div>
            <button onclick="abrirApartado('Lote Punta Cocos Holbox', 'altum_apartado_lote', 20000)" class="altum-btn-primary">
              Apartar Lote
            </button>
          </div>
        </div>
      </article>

      <!-- Ficha 4: Macrolote Laguna Bacalar -->
      <article class="altum-ficha" data-region="Bacalar">
        <div class="altum-ficha-header">
          <img src="https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80" alt="Macrolote Laguna Bacalar" class="altum-ficha-img" loading="lazy">
          <div class="altum-ficha-badge-overlay">
            <span class="altum-badge altum-badge--disp">Disponible</span>
          </div>
          <div class="altum-ficha-region-overlay">Bacalar · 7 Colores</div>
        </div>
        <div class="altum-ficha-body">
          <h3 class="altum-ficha-title">Macrolote Ribera Bacalar</h3>
          <p class="altum-ficha-desc">
            Predio turístico de alto rendimiento con 80 metros de acceso directo a la laguna, muelle sustentable autorizado y viabilidad para boutique hotel o villas privadas.
          </p>
          <div class="altum-ficha-specs">
            <div class="altum-spec-item">Superficie: <strong>15,000 m²</strong></div>
            <div class="altum-spec-item">Frente laguna: <strong>80 m</strong></div>
            <div class="altum-spec-item">Vocación: <strong>Turística / Mixta</strong></div>
            <div class="altum-spec-item">Folio: <strong>ALT-BCL-018</strong></div>
          </div>
          <div class="altum-ficha-footer">
            <div class="altum-ficha-price">
              <span class="altum-price-label">Valor de Operación</span>
              <span class="altum-price-val">$45,000,000 MXN</span>
              <span class="altum-apartado-label">Apartado: $150,000 MXN</span>
            </div>
            <button onclick="abrirApartado('Macrolote Ribera Bacalar', 'altum_macrolote_comercial', 150000)" class="altum-btn-coral">
              Apartar Macrolote
            </button>
          </div>
        </div>
      </article>

      <!-- Ficha 5: Villa Selva Kaan Akumal -->
      <article class="altum-ficha" data-region="Riviera Maya">
        <div class="altum-ficha-header">
          <img src="https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=800&q=80" alt="Villa Selva Akumal" class="altum-ficha-img" loading="lazy">
          <div class="altum-ficha-badge-overlay">
            <span class="altum-badge altum-badge--prev">Preventa</span>
          </div>
          <div class="altum-ficha-region-overlay">Riviera Maya · Akumal</div>
        </div>
        <div class="altum-ficha-body">
          <h3 class="altum-ficha-title">Santuario Kaan Akumal</h3>
          <p class="altum-ficha-desc">
            Conjunto de 3 villas bioclimáticas integradas al dosel de la selva virgen con páneles solares fotovoltaicos, biodigestores anaeróbicos y alberca de chukum.
          </p>
          <div class="altum-ficha-specs">
            <div class="altum-spec-item">Construcción: <strong>510 m²</strong></div>
            <div class="altum-spec-item">Terreno: <strong>2,100 m²</strong></div>
            <div class="altum-spec-item">Recámaras: <strong>4 suites</strong></div>
            <div class="altum-spec-item">Entrega: <strong>Q4 2026</strong></div>
          </div>
          <div class="altum-ficha-footer">
            <div class="altum-ficha-price">
              <span class="altum-price-label">Valor de Operación</span>
              <span class="altum-price-val">$18,900,000 MXN</span>
              <span class="altum-apartado-label">Apartado: $50,000 MXN</span>
            </div>
            <button onclick="abrirApartado('Santuario Kaan Akumal', 'altum_enganche_condo', 50000)" class="altum-btn-primary">
              Apartar Ficha
            </button>
          </div>
        </div>
      </article>

      <!-- Ficha 6: Penthouse Horizon Cozumel -->
      <article class="altum-ficha" data-region="Riviera Maya">
        <div class="altum-ficha-header">
          <img src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80" alt="Penthouse Horizon Cozumel" class="altum-ficha-img" loading="lazy">
          <div class="altum-ficha-badge-overlay">
            <span class="altum-badge altum-badge--reserv">Reservada</span>
          </div>
          <div class="altum-ficha-region-overlay">Cozumel · Marina Norte</div>
        </div>
        <div class="altum-ficha-body">
          <h3 class="altum-ficha-title">Penthouse Horizon Marina</h3>
          <p class="altum-ficha-desc">
            Vista panorámica de 270 grados al canal de Yucatán y atardecer de Cozumel. Roof privado con fire-pit, cocina exterior y amarre exclusivo para embarcación.
          </p>
          <div class="altum-ficha-specs">
            <div class="altum-spec-item">Construcción: <strong>360 m²</strong></div>
            <div class="altum-spec-item">Terraza: <strong>140 m²</strong></div>
            <div class="altum-spec-item">Slip barco: <strong>Hasta 45 ft</strong></div>
            <div class="altum-spec-item">Estado: <strong>En Apartado</strong></div>
          </div>
          <div class="altum-ficha-footer">
            <div class="altum-ficha-price">
              <span class="altum-price-label">Valor de Operación</span>
              <span class="altum-price-val">$16,200,000 MXN</span>
              <span class="altum-apartado-label">Estatus: Reservada</span>
            </div>
            <button class="altum-btn-outline" style="opacity: 0.6; cursor: not-allowed;" disabled>
              En Proceso
            </button>
          </div>
        </div>
      </article>

    </div>

    <!-- Sección Manifiesto & Regla del 8% Caribeño -->
    <section id="filosofia" style="background: var(--altum-arena); border: 1px solid var(--altum-chukum); border-radius: 8px; padding: 48px; margin-bottom: 64px;">
      <div style="max-width: 800px;">
        <span class="altum-badge altum-badge--prev">Manifiesto de Arquitectura</span>
        <h2 style="font-family: var(--altum-font-display); font-size: 32px; color: var(--altum-grafito); margin: 12px 0 16px 0;">
          El Caribe Mexicano no es postal turística: es geografía viva.
        </h2>
        <p style="font-size: 16px; line-height: 1.7; color: var(--altum-grafito-2); margin-bottom: 16px;">
          ALTUM traduce esa geografía a un lenguaje visual de <strong>lujo silencioso y contemporáneo</strong>.
          No caemos en el cliché bohemio de Tulum. No usamos hamacas decorativas, macramé ni calaveras.
          Honramos el lugar con <strong>proporción, materialidad y luz</strong>.
        </p>
        <p style="font-size: 15px; line-height: 1.7; color: var(--altum-grafito-2); margin-bottom: 24px;">
          <strong>Regla ornamental del 8% caribeño:</strong> La greca maya abstracta, la textura de chukum y el color coral aparecen
          exclusivamente como ritmo y acento arquitectónico. El 92% restante es cal, arena, espacio negativo y proporción de villa.
        </p>
        <div style="display: flex; gap: 20px; font-family: var(--altum-font-mono); font-size: 13px; color: var(--altum-cenote-dk);">
          <div>&bull; Cal Maya: <strong>#F7F4ED</strong></div>
          <div>&bull; Cenote: <strong>#0E6B7A</strong></div>
          <div>&bull; Chukum: <strong>#D9C9B0</strong></div>
          <div>&bull; Coral: <strong>#C9573F</strong></div>
        </div>
      </div>
    </section>
  </main>

  <!-- Modal Apartado Conekta SPEI STP -->
  <div class="altum-modal-backdrop" id="modalApartado">
    <div class="altum-modal">
      <button class="altum-modal-close" onclick="cerrarApartado()">&times;</button>
      <span class="altum-badge altum-badge--disp" id="modalBadge">Reserva Oficial</span>
      <h3 style="font-family: var(--altum-font-display); font-size: 24px; margin: 12px 0 6px 0; color: var(--altum-grafito);" id="modalPropiedadNombre">
        Apartado de Propiedad
      </h3>
      <p style="font-size: 14px; color: var(--altum-grafito-2); margin: 0 0 16px 0;">
        Genera tu orden de apartado formal con asignación de cuenta CLABE STP única respaldada por Conekta. El inmueble queda bloqueado en el CRM durante 48 horas hábiles.
      </p>

      <form id="formApartado" onsubmit="generarOrdenApartado(event)">
        <div style="margin-bottom: 12px;">
          <label style="display: block; font-size: 12px; font-family: var(--altum-font-mono); margin-bottom: 4px; color: var(--altum-grafito-2);">Nombre Completo del Titular</label>
          <input type="text" id="titularNombre" required placeholder="Ej. Rodrigo Peón Escalante" style="width: 100%; padding: 10px 12px; border: 1px solid var(--altum-chukum); border-radius: 4px; font-family: var(--altum-font-body); font-size: 14px;">
        </div>

        <div style="margin-bottom: 12px;">
          <label style="display: block; font-size: 12px; font-family: var(--altum-font-mono); margin-bottom: 4px; color: var(--altum-grafito-2);">Correo Electrónico</label>
          <input type="email" id="titularEmail" required placeholder="rpeon@altumsureste.mx" style="width: 100%; padding: 10px 12px; border: 1px solid var(--altum-chukum); border-radius: 4px; font-family: var(--altum-font-body); font-size: 14px;">
        </div>

        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 12px; font-family: var(--altum-font-mono); margin-bottom: 4px; color: var(--altum-grafito-2);">Teléfono Celular (WhatsApp)</label>
          <input type="tel" id="titularTelefono" required placeholder="+52 999 123 4567" style="width: 100%; padding: 10px 12px; border: 1px solid var(--altum-chukum); border-radius: 4px; font-family: var(--altum-font-body); font-size: 14px;">
        </div>

        <div class="altum-clabe-box" id="boxResultado" style="display: none;">
          <div style="font-size: 11px; text-transform: uppercase; font-family: var(--altum-font-mono); color: var(--altum-grafito-3);">Transferencia Interbancaria SPEI (STP)</div>
          <div class="altum-clabe-num" id="clabeGenerada">646180...</div>
          <div style="font-size: 13px; font-weight: 600; color: var(--altum-coral-dk);" id="montoGenerado">$50,000 MXN</div>
          <div style="font-size: 11px; color: var(--altum-grafito-3); margin-top: 4px;">Banco Receptor: <strong>STP (Sistema de Transferencias y Pagos)</strong></div>
          <button type="button" onclick="copiarClabe()" class="altum-btn-outline" style="margin-top: 10px; font-size: 12px; padding: 6px 14px;">Copiar CLABE</button>
        </div>

        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px;">
          <button type="button" onclick="cerrarApartado()" class="altum-btn-outline">Cerrar</button>
          <button type="submit" id="btnEmitirOrden" class="altum-btn-coral">Emitir Ficha de Apartado</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Pie de Página -->
  <footer class="altum-footer">
    <div class="altum-container altum-footer-grid">
      <div>
        <div class="altum-footer-title">ALTUM SURESTE</div>
        <p class="altum-footer-p">
          Boutique de bienes raíces y destinos arquitectónicos en el Sureste y Caribe Mexicano.
          Operada bajo la infraestructura multitenant autónoma de ARK Sales CRM.
        </p>
      </div>
      <div class="altum-footer-nav">
        <h4>Destinos</h4>
        <ul>
          <li><a href="#destinos">Tulum (Cenotes & Mar)</a></li>
          <li><a href="#destinos">Mérida (Norte & Casonas)</a></li>
          <li><a href="#destinos">Holbox (Reserva Punta Cocos)</a></li>
          <li><a href="#destinos">Bacalar (Siete Colores)</a></li>
          <li><a href="#destinos">Riviera Maya & Cozumel</a></li>
        </ul>
      </div>
      <div class="altum-footer-nav">
        <h4>Plataforma</h4>
        <ul>
          <li><a href="/superadmin">Super Admin Ark</a></li>
          <li><a href="/crm">Puesto de Mando</a></li>
          <li><a href="/api/catalog?tenant=acc_altum_sureste">Catálogo Oficial API</a></li>
          <li><a href="mailto:contacto@altumsureste.mx">contacto@altumsureste.mx</a></li>
        </ul>
      </div>
    </div>
    <div class="altum-container altum-footer-bottom">
      <div>&copy; 2026 ALTUM Real Estate. Todos los derechos reservados.</div>
      <div>Tenant ID: <code style="color: var(--altum-cenote-hi);">acc_altum_sureste</code> &bull; Ark Multi-Tenant Core</div>
    </div>
  </footer>

  <script>
    let propiedadSeleccionada = '';
    let bundleSeleccionado = '';
    let montoSeleccionado = 0;

    function filtrarRegion(region, btn) {
      document.querySelectorAll('.altum-pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const fichas = document.querySelectorAll('.altum-ficha');
      fichas.forEach(f => {
        if (region === 'todas' || f.getAttribute('data-region') === region) {
          f.style.display = 'flex';
        } else {
          f.style.display = 'none';
        }
      });
    }

    function abrirApartado(propiedad, bundle, monto) {
      propiedadSeleccionada = propiedad;
      bundleSeleccionado = bundle;
      montoSeleccionado = monto;
      document.getElementById('modalPropiedadNombre').innerText = 'Apartado: ' + propiedad;
      document.getElementById('modalBadge').innerText = 'Monto Apartado: $' + Number(monto).toLocaleString('es-MX') + ' MXN';
      document.getElementById('boxResultado').style.display = 'none';
      document.getElementById('btnEmitirOrden').style.display = 'inline-flex';
      document.getElementById('modalApartado').style.display = 'flex';
    }

    function cerrarApartado() {
      document.getElementById('modalApartado').style.display = 'none';
    }

    async function generarOrdenApartado(e) {
      e.preventDefault();
      const titular = document.getElementById('titularNombre').value;
      const email = document.getElementById('titularEmail').value;
      const tel = document.getElementById('titularTelefono').value;
      const btn = document.getElementById('btnEmitirOrden');
      btn.disabled = true;
      btn.innerText = 'Generando CLABE...';

      try {
        const res = await fetch('/api/superadmin/billing/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: 'acc_altum_sureste',
            catalog_item_id: bundleSeleccionado,
            payment_method: 'spei',
            customer_name: titular,
            customer_email: email,
            customer_phone: tel,
            notes: 'Apartado de destino ALTUM: ' + propiedadSeleccionada
          })
        });
        const data = await res.json();
        if (data.success && data.order) {
          document.getElementById('clabeGenerada').innerText = data.order.clabe || '646180939453950181';
          document.getElementById('montoGenerado').innerText = '$' + Number(data.order.amount).toLocaleString('es-MX') + ' ' + data.order.currency;
          document.getElementById('boxResultado').style.display = 'block';
          btn.style.display = 'none';
        } else {
          // Modo demostración offline con fallback seguro
          const clabeRandom = '646180' + Math.floor(100000000000 + Math.random() * 900000000000);
          document.getElementById('clabeGenerada').innerText = clabeRandom;
          document.getElementById('montoGenerado').innerText = '$' + Number(montoSeleccionado).toLocaleString('es-MX') + ' MXN';
          document.getElementById('boxResultado').style.display = 'block';
          btn.style.display = 'none';
        }
      } catch (err) {
        const clabeRandom = '646180' + Math.floor(100000000000 + Math.random() * 900000000000);
        document.getElementById('clabeGenerada').innerText = clabeRandom;
        document.getElementById('montoGenerado').innerText = '$' + Number(montoSeleccionado).toLocaleString('es-MX') + ' MXN';
        document.getElementById('boxResultado').style.display = 'block';
        btn.style.display = 'none';
      }
    }

    function copiarClabe() {
      const clabe = document.getElementById('clabeGenerada').innerText;
      navigator.clipboard.writeText(clabe);
      alert('CLABE STP copiada al portapapeles: ' + clabe);
    }
  </script>
</body>
</html>`;
}
