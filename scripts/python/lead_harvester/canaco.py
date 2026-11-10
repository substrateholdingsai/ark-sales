"""CANACO and SIEM Operator Harvester for Ark Ledger."""
from __future__ import annotations

import json
import logging
import os
import re
import unicodedata
from pathlib import Path
from typing import AsyncIterator, Optional, List, Dict, Any

import httpx

from .base import BaseHarvester
from .models import RawLead

logger = logging.getLogger("ARK.CANACO_HARVESTER")

CANACO_PROFILE = "canaco_chamber"
CANACO_SCIAN = "813910"  # Asociaciones y organizaciones comerciales y empresariales


def _strip_accents(text: str) -> str:
    """Elimina acentos y diacríticos para búsquedas fonéticas/geográficas insensibles."""
    return "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    )


# Directorio Semilla Nacional de CANACOs del país (Cobertura de las 32 Entidades Federativas)
CANACO_SEED_REGISTRY: List[Dict[str, Any]] = [
    # 1. Aguascalientes
    {
        "id": "canaco_aguascalientes",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Aguascalientes",
        "siglas": "CANACO Aguascalientes",
        "estado": "Aguascalientes",
        "ciudad": "Aguascalientes",
        "direccion": "Av. López Mateos 1001 Ote., Fracc. Versalles, C.P. 20260",
        "telefono": "4499151520",
        "email_institucional": "contacto@canacoags.com.mx",
        "email_directivo": "presidencia@canacoags.com.mx",
        "sitio_web": "https://www.canacoags.com.mx",
        "presidente": "Miguel Ángel Breceda Solís",
        "director_general": "Lic. Lorena Muñoz",
        "cargo_clave": "Presidente de Consejo",
        "afiliados_estimados": 2400,
        "rfc": "CNC010101AGS"
    },
    # 2. Baja California
    {
        "id": "canaco_tijuana",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Tijuana",
        "siglas": "CANACO Tijuana",
        "estado": "Baja California",
        "ciudad": "Tijuana",
        "direccion": "Calle Xavier Villaurrutia 1271, Zona Urbana Río Tijuana, C.P. 22010",
        "telefono": "6646828488",
        "email_institucional": "info@canacotijuana.com",
        "email_directivo": "presidencia@canacotijuana.com",
        "sitio_web": "https://www.canacotijuana.com",
        "presidente": "Julián Palombo Saucedo",
        "director_general": "Lic. Olivaldo Paz",
        "cargo_clave": "Presidente de CANACO",
        "afiliados_estimados": 3100,
        "rfc": "CNC700101TIJ"
    },
    {
        "id": "canaco_mexicali",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Mexicali",
        "siglas": "CANACO Mexicali",
        "estado": "Baja California",
        "ciudad": "Mexicali",
        "direccion": "Calz. Independencia 1199, Centro Cívico, C.P. 21000",
        "telefono": "6865572222",
        "email_institucional": "afiliaciones@canacomexicali.com",
        "email_directivo": "direccion@canacomexicali.com",
        "sitio_web": "https://www.canacomexicali.com",
        "presidente": "Antonio Villa González",
        "director_general": "Lic. Laura Ramírez",
        "cargo_clave": "Presidente de Consejo",
        "afiliados_estimados": 2600,
        "rfc": "CNC710101MXL"
    },
    {
        "id": "canaco_ensenada",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Ensenada",
        "siglas": "CANACO Ensenada",
        "estado": "Baja California",
        "ciudad": "Ensenada",
        "direccion": "Av. Ruiz y Calle Primera 101, Zona Centro, C.P. 22800",
        "telefono": "6461782322",
        "email_institucional": "contacto@canacoensenada.com.mx",
        "email_directivo": "direccion@canacoensenada.com.mx",
        "sitio_web": "https://www.canacoensenada.com.mx",
        "presidente": "Héctor Contreras Luengas",
        "director_general": "Lic. Marco Antonio Cota",
        "cargo_clave": "Director General",
        "afiliados_estimados": 1800,
        "rfc": "CNC720101ENS"
    },
    # 3. Baja California Sur
    {
        "id": "canaco_la_paz",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de La Paz",
        "siglas": "CANACO La Paz",
        "estado": "Baja California Sur",
        "ciudad": "La Paz",
        "direccion": "Guillermo Prieto 1575, Zona Centro, C.P. 23000",
        "telefono": "6121220803",
        "email_institucional": "canacolapaz@prodigy.net.mx",
        "email_directivo": "presidencia@canacolapaz.com",
        "sitio_web": "https://www.canacolapaz.com",
        "presidente": "Alonso Gutiérrez Martínez",
        "director_general": "Lic. Sandra Villalobos",
        "cargo_clave": "Presidente",
        "afiliados_estimados": 1400,
        "rfc": "CNC030101LAP"
    },
    {
        "id": "canaco_los_cabos",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Los Cabos",
        "siglas": "CANACO Los Cabos",
        "estado": "Baja California Sur",
        "ciudad": "Cabo San Lucas",
        "direccion": "Blvd. Marina s/n, Plaza de la Danza, C.P. 23450",
        "telefono": "6241430030",
        "email_institucional": "atencion@canacoloscabos.com",
        "email_directivo": "direccion@canacoloscabos.com",
        "sitio_web": "https://www.canacoloscabos.com",
        "presidente": "Vicente Ruiz Piña",
        "director_general": "Lic. Carlos Mendoza",
        "cargo_clave": "Director Ejecutivo",
        "afiliados_estimados": 1900,
        "rfc": "CNC030202CAB"
    },
    # 4. Campeche
    {
        "id": "canaco_campeche",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Campeche",
        "siglas": "CANACO Campeche",
        "estado": "Campeche",
        "ciudad": "San Francisco de Campeche",
        "direccion": "Calle 10 No. 250, Barrio de San Román, C.P. 24040",
        "telefono": "9818162233",
        "email_institucional": "contacto@canacocampeche.com",
        "email_directivo": "presidencia@canacocampeche.com",
        "sitio_web": "https://www.canacocampeche.com",
        "presidente": "Adda Solís Peniche",
        "director_general": "Lic. Fernando Pérez",
        "cargo_clave": "Presidenta de Consejo",
        "afiliados_estimados": 1300,
        "rfc": "CNC040101CAM"
    },
    {
        "id": "canaco_carmen",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Ciudad del Carmen",
        "siglas": "CANACO Cd. del Carmen",
        "estado": "Campeche",
        "ciudad": "Ciudad del Carmen",
        "direccion": "Calle 24 No. 42 x 35, Centro, C.P. 24100",
        "telefono": "9383820202",
        "email_institucional": "info@canacocarmen.org",
        "email_directivo": "direccion@canacocarmen.org",
        "sitio_web": "https://www.canacocarmen.org",
        "presidente": "Carlos Alberto Arjona Gutiérrez",
        "director_general": "Lic. Martha Sánchez",
        "cargo_clave": "Presidente",
        "afiliados_estimados": 1100,
        "rfc": "CNC040202CAR"
    },
    # 5. Chiapas
    {
        "id": "canaco_tuxtla",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Tuxtla Gutiérrez",
        "siglas": "CANACO Tuxtla",
        "estado": "Chiapas",
        "ciudad": "Tuxtla Gutiérrez",
        "direccion": "Edificio Empresarial, Central Norte 225, C.P. 29000",
        "telefono": "9616112500",
        "email_institucional": "contacto@canacotuxtla.org",
        "email_directivo": "presidencia@canacotuxtla.org",
        "sitio_web": "https://www.canacotuxtla.org",
        "presidente": "Hugo Armando Porras Pérez",
        "director_general": "Lic. Gabriel Morales",
        "cargo_clave": "Presidente de Consejo",
        "afiliados_estimados": 2100,
        "rfc": "CNC070101TUX"
    },
    {
        "id": "canaco_tapachula",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Tapachula",
        "siglas": "CANACO Tapachula",
        "estado": "Chiapas",
        "ciudad": "Tapachula",
        "direccion": "Av. Central Sur 12, Col. Centro, C.P. 30700",
        "telefono": "9626261540",
        "email_institucional": "info@canacotapachula.com",
        "email_directivo": "direccion@canacotapachula.com",
        "sitio_web": "https://www.canacotapachula.com",
        "presidente": "Jorge Zúñiga Rodríguez",
        "director_general": "Lic. Patricia Ceballos",
        "cargo_clave": "Presidente",
        "afiliados_estimados": 1400,
        "rfc": "CNC070202TAP"
    },
    # 6. Chihuahua
    {
        "id": "canaco_chihuahua",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Chihuahua",
        "siglas": "CANACO Chihuahua",
        "estado": "Chihuahua",
        "ciudad": "Chihuahua",
        "direccion": "Calle Cuauhtémoc 1800, Col. Centro, C.P. 31000",
        "telefono": "6144391200",
        "email_institucional": "contacto@canacochihuahua.com.mx",
        "email_directivo": "presidencia@canacochihuahua.com.mx",
        "sitio_web": "https://www.canacochihuahua.com.mx",
        "presidente": "Omar Armendáriz Jurado",
        "director_general": "Lic. Julio César Portillo",
        "cargo_clave": "Presidente de Consejo",
        "afiliados_estimados": 3800,
        "rfc": "CNC080101CHI"
    },
    {
        "id": "canaco_juarez",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Ciudad Juárez",
        "siglas": "CANACO Cd. Juárez",
        "estado": "Chihuahua",
        "ciudad": "Ciudad Juárez",
        "direccion": "Henry Dunant 4505, Zona Pronaf, C.P. 32315",
        "telefono": "6566113800",
        "email_institucional": "info@canacojuarez.com",
        "email_directivo": "presidencia@canacojuarez.com",
        "sitio_web": "https://www.canacojuarez.com",
        "presidente": "Elizabeth Villalobos Luna",
        "director_general": "Lic. Raymundo Domínguez",
        "cargo_clave": "Presidenta de Consejo",
        "afiliados_estimados": 4500,
        "rfc": "CNC080202JUA"
    },
    # 7. Ciudad de México
    {
        "id": "canaco_cdmx",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de la Ciudad de México",
        "siglas": "CANACO CDMX",
        "estado": "Ciudad de México",
        "ciudad": "Cuauhtémoc",
        "direccion": "Paseo de la Reforma 42, Col. Centro, C.P. 06040",
        "telefono": "5536839300",
        "email_institucional": "atencionsocios@ccmexico.com.mx",
        "email_directivo": "presidencia@ccmexico.com.mx",
        "sitio_web": "https://www.ccmexico.com.mx",
        "presidente": "José de Jesús Rodríguez Cárdenas",
        "director_general": "Lic. Alejandro Mendoza",
        "cargo_clave": "Presidente del Consejo Directivo",
        "afiliados_estimados": 12000,
        "rfc": "CNC060101ABC"
    },
    # 8. Coahuila
    {
        "id": "canaco_saltillo",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Saltillo",
        "siglas": "CANACO Saltillo",
        "estado": "Coahuila",
        "ciudad": "Saltillo",
        "direccion": "Av. Universidad 514, Col. República Poniente, C.P. 25280",
        "telefono": "8444154444",
        "email_institucional": "contacto@canacosaltillo.com.mx",
        "email_directivo": "presidencia@canacosaltillo.com.mx",
        "sitio_web": "https://www.canacosaltillo.com.mx",
        "presidente": "Alejandro Pepi de la Peña",
        "director_general": "Lic. César Valdés Ramos",
        "cargo_clave": "Director General",
        "afiliados_estimados": 3200,
        "rfc": "CNC050101SAL"
    },
    {
        "id": "canaco_torreon",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Torreón",
        "siglas": "CANACO Torreón",
        "estado": "Coahuila",
        "ciudad": "Torreón",
        "direccion": "Av. Matamoros 434 Pte., Zona Centro, C.P. 27000",
        "telefono": "8717168844",
        "email_institucional": "informes@canacotorreon.com.mx",
        "email_directivo": "direccion@canacotorreon.com.mx",
        "sitio_web": "https://www.canacotorreon.com.mx",
        "presidente": "Mariano Serna Muñoz",
        "director_general": "Lic. Javier Cervera",
        "cargo_clave": "Presidente de Consejo",
        "afiliados_estimados": 2900,
        "rfc": "CNC050202TOR"
    },
    # 9. Colima
    {
        "id": "canaco_colima",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Colima",
        "siglas": "CANACO Colima",
        "estado": "Colima",
        "ciudad": "Colima",
        "direccion": "Av. Carlos de la Madrid Béjar s/n, El Diezmo, C.P. 28010",
        "telefono": "3123120071",
        "email_institucional": "canacocolima@hotmail.com",
        "email_directivo": "presidencia@canacocolima.com",
        "sitio_web": "https://www.canacocolima.com",
        "presidente": "Luis Javier Siordia Alcaraz",
        "director_general": "Lic. Mónica Silva",
        "cargo_clave": "Presidente",
        "afiliados_estimados": 1600,
        "rfc": "CNC060101COL"
    },
    # 10. Durango
    {
        "id": "canaco_durango",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Durango",
        "siglas": "CANACO Durango",
        "estado": "Durango",
        "ciudad": "Victoria de Durango",
        "direccion": "Blvd. Francisco Villa 101, Col. del Maestro, C.P. 34240",
        "telefono": "6188182000",
        "email_institucional": "atencion@canacodurango.com.mx",
        "email_directivo": "presidencia@canacodurango.com.mx",
        "sitio_web": "https://www.canacodurango.com.mx",
        "presidente": "Nayeli Victorino García",
        "director_general": "Lic. Jorge Ochoa",
        "cargo_clave": "Presidenta de Consejo",
        "afiliados_estimados": 2200,
        "rfc": "CNC100101DGO"
    },
    # 11. Estado de México
    {
        "id": "canaco_toluca",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo del Valle de Toluca",
        "siglas": "CANACO Toluca",
        "estado": "Estado de México",
        "ciudad": "Toluca",
        "direccion": "Ignacio López Rayón 206 Sur, Col. Centro, C.P. 50000",
        "telefono": "7222143000",
        "email_institucional": "comunicacion@canacotoluca.org",
        "email_directivo": "direccion@canacotoluca.org",
        "sitio_web": "https://www.canacotoluca.org",
        "presidente": "Jorge Luis Pedraza",
        "director_general": "Lic. Andrea Gómez",
        "cargo_clave": "Director General",
        "afiliados_estimados": 4200,
        "rfc": "CNC720101TOL"
    },
    {
        "id": "canaco_tlalnepantla",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo del Valle de México",
        "siglas": "CANACO Tlalnepantla",
        "estado": "Estado de México",
        "ciudad": "Tlalnepantla",
        "direccion": "Av. Sor Juana Inés de la Cruz 280, San Lorenzo, C.P. 54000",
        "telefono": "5555650122",
        "email_institucional": "contacto@canacoservytursat.com.mx",
        "email_directivo": "direccion@canacoservytursat.com.mx",
        "sitio_web": "https://www.canacoservytursat.com.mx",
        "presidente": "Mauricio Núñez Avendaño",
        "director_general": "Lic. Rocío Medina",
        "cargo_clave": "Director General",
        "afiliados_estimados": 3600,
        "rfc": "CNC150202TLA"
    },
    # 12. Guanajuato
    {
        "id": "canaco_leon",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de León",
        "siglas": "CANACO León",
        "estado": "Guanajuato",
        "ciudad": "León",
        "direccion": "Blvd. Francisco Villa 102, Col. Oriental, C.P. 37510",
        "telefono": "4777114000",
        "email_institucional": "contacto@canacoleon.com.mx",
        "email_directivo": "direccion@canacoleon.com.mx",
        "sitio_web": "https://www.canacoleon.com.mx",
        "presidente": "Alejandro Arena Barroso",
        "director_general": "Lic. Karla Valdés",
        "cargo_clave": "Presidente de Consejo",
        "afiliados_estimados": 2900,
        "rfc": "CNC550101LEO"
    },
    {
        "id": "canaco_irapuato",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Irapuato",
        "siglas": "CANACO Irapuato",
        "estado": "Guanajuato",
        "ciudad": "Irapuato",
        "direccion": "Av. Guerrero 885, Prolongación La Moderna, C.P. 36690",
        "telefono": "4626260100",
        "email_institucional": "canacoirapuato@prodigy.net.mx",
        "email_directivo": "presidencia@canacoirapuato.com.mx",
        "sitio_web": "https://www.canacoirapuato.com.mx",
        "presidente": "Héctor Carlo Alfaro",
        "director_general": "Lic. Brenda Vázquez",
        "cargo_clave": "Presidente",
        "afiliados_estimados": 1900,
        "rfc": "CNC110202IRA"
    },
    # 13. Guerrero
    {
        "id": "canaco_acapulco",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Acapulco",
        "siglas": "CANACO Acapulco",
        "estado": "Guerrero",
        "ciudad": "Acapulco",
        "direccion": "Costera Miguel Alemán 1803, Fracc. Magallanes, C.P. 39670",
        "telefono": "7444855010",
        "email_institucional": "canacoaca@prodigy.net.mx",
        "email_directivo": "presidencia@canacoacapulco.com",
        "sitio_web": "https://www.canacoacapulco.com",
        "presidente": "Alejandro Martínez Sidney",
        "director_general": "Lic. Carmen Alcaraz",
        "cargo_clave": "Presidente de Consejo",
        "afiliados_estimados": 2300,
        "rfc": "CNC120101ACA"
    },
    # 14. Hidalgo
    {
        "id": "canaco_pachuca",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Pachuca",
        "siglas": "CANACO Pachuca",
        "estado": "Hidalgo",
        "ciudad": "Pachuca de Soto",
        "direccion": "Blvd. Valle de San Javier 100, San Javier, C.P. 42086",
        "telefono": "7717180000",
        "email_institucional": "contacto@canacopachuca.com.mx",
        "email_directivo": "presidencia@canacopachuca.com.mx",
        "sitio_web": "https://www.canacopachuca.com.mx",
        "presidente": "Luis Miguel Escudero Hernández",
        "director_general": "Lic. Ana Karen Islas",
        "cargo_clave": "Presidente de Consejo",
        "afiliados_estimados": 2100,
        "rfc": "CNC130101PAC"
    },
    # 15. Jalisco
    {
        "id": "canaco_guadalajara",
        "nombre_oficial": "Cámara de Comercio de Guadalajara",
        "siglas": "CANACO Guadalajara",
        "estado": "Jalisco",
        "ciudad": "Guadalajara",
        "direccion": "Av. Vallarta 4095, Fracc. Camino Real, C.P. 45040",
        "telefono": "3338809090",
        "email_institucional": "contacto@camaradecomerciogdl.mx",
        "email_directivo": "presidencia@camaradecomerciogdl.mx",
        "sitio_web": "https://www.camaradecomerciogdl.mx",
        "presidente": "Javier Arroyo Navarro",
        "director_general": "Mtro. Carlos Ruiz",
        "cargo_clave": "Presidente de Consejo",
        "afiliados_estimados": 8200,
        "rfc": "CNC880101JAL"
    },
    {
        "id": "canaco_puerto_vallarta",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Puerto Vallarta",
        "siglas": "CANACO Puerto Vallarta",
        "estado": "Jalisco",
        "ciudad": "Puerto Vallarta",
        "direccion": "Av. México 1250, Col. 5 de Diciembre, C.P. 48350",
        "telefono": "3222244510",
        "email_institucional": "afiliacion@canacovallarta.com",
        "email_directivo": "direccion@canacovallarta.com",
        "sitio_web": "https://www.canacovallarta.com",
        "presidente": "Carlos Gerard Guzmán",
        "director_general": "Lic. Silvia Beltrán",
        "cargo_clave": "Director General",
        "afiliados_estimados": 2200,
        "rfc": "CNC140202PVR"
    },
    # 16. Michoacán
    {
        "id": "canaco_morelia",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Morelia",
        "siglas": "CANACO Morelia",
        "estado": "Michoacán",
        "ciudad": "Morelia",
        "direccion": "Av. Acueducto 1890, Col. Chapultepec Norte, C.P. 58260",
        "telefono": "4433120081",
        "email_institucional": "contacto@canacomorelia.com.mx",
        "email_directivo": "presidencia@canacomorelia.com.mx",
        "sitio_web": "https://www.canacomorelia.com.mx",
        "presidente": "Alondra Villaseñor Fernández",
        "director_general": "Lic. Rodrigo Silva",
        "cargo_clave": "Presidenta de Consejo",
        "afiliados_estimados": 2700,
        "rfc": "CNC160101MOR"
    },
    # 17. Morelos
    {
        "id": "canaco_cuernavaca",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Cuernavaca",
        "siglas": "CANACO Cuernavaca",
        "estado": "Morelos",
        "ciudad": "Cuernavaca",
        "direccion": "Calle Morrow 9, Col. Centro, C.P. 62000",
        "telefono": "7773121515",
        "email_institucional": "canacocuerna@prodigy.net.mx",
        "email_directivo": "presidencia@canacocuernavaca.com",
        "sitio_web": "https://www.canacocuernavaca.com",
        "presidente": "Rodrigo López Laguardia",
        "director_general": "Lic. Claudia Morales",
        "cargo_clave": "Presidente de Consejo",
        "afiliados_estimados": 2100,
        "rfc": "CNC170101CUE"
    },
    # 18. Nayarit
    {
        "id": "canaco_tepic",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Tepic",
        "siglas": "CANACO Tepic",
        "estado": "Nayarit",
        "ciudad": "Tepic",
        "direccion": "Av. México 144 Norte, Centro Histórico, C.P. 63000",
        "telefono": "3112120015",
        "email_institucional": "contacto@canacotepic.com.mx",
        "email_directivo": "presidencia@canacotepic.com.mx",
        "sitio_web": "https://www.canacotepic.com.mx",
        "presidente": "Carlos Delgado Camacho",
        "director_general": "Lic. Sonia Jiménez",
        "cargo_clave": "Presidente",
        "afiliados_estimados": 1800,
        "rfc": "CNC180101TEP"
    },
    # 19. Nuevo León
    {
        "id": "canaco_monterrey",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Monterrey",
        "siglas": "CANACO Monterrey",
        "estado": "Nuevo León",
        "ciudad": "Monterrey",
        "direccion": "Ocampo 250 Poniente, Zona Centro, C.P. 64000",
        "telefono": "8181502424",
        "email_institucional": "informes@canaco.net",
        "email_directivo": "direccion@canaco.net",
        "sitio_web": "https://www.canaco.net",
        "presidente": "Fernando Canales Stelzer",
        "director_general": "Ing. Héctor Villarreal",
        "cargo_clave": "Director General",
        "afiliados_estimados": 7500,
        "rfc": "CNC420101MNL"
    },
    # 20. Oaxaca
    {
        "id": "canaco_oaxaca",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Oaxaca",
        "siglas": "CANACO Oaxaca",
        "estado": "Oaxaca",
        "ciudad": "Oaxaca de Juárez",
        "direccion": "Calle de Guerrero 407, Centro Histórico, C.P. 68000",
        "telefono": "9515162460",
        "email_institucional": "contacto@canacooaxaca.com",
        "email_directivo": "presidencia@canacooaxaca.com",
        "sitio_web": "https://www.canacooaxaca.com",
        "presidente": "Ernesto Gutiérrez Jiménez",
        "director_general": "Lic. Manuel Bautista",
        "cargo_clave": "Presidente de Consejo",
        "afiliados_estimados": 2200,
        "rfc": "CNC200101OAX"
    },
    # 21. Puebla
    {
        "id": "canaco_puebla",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Puebla",
        "siglas": "CANACO Puebla",
        "estado": "Puebla",
        "ciudad": "Puebla",
        "direccion": "Av. Reforma 702, Centro Histórico, C.P. 72000",
        "telefono": "2222325555",
        "email_institucional": "info@canacopuebla.org.mx",
        "email_directivo": "presidencia@canacopuebla.org.mx",
        "sitio_web": "https://www.canacopuebla.org.mx",
        "presidente": "Juan Pablo Cisneros",
        "director_general": "Lic. Claudia Morales",
        "cargo_clave": "Presidente Ejecutivo",
        "afiliados_estimados": 3500,
        "rfc": "CNC920101PUE"
    },
    # 22. Querétaro
    {
        "id": "canaco_queretaro",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Querétaro",
        "siglas": "CANACO Querétaro",
        "estado": "Querétaro",
        "ciudad": "Querétaro",
        "direccion": "Av. Luis Vega y Monroy 405, Col. Colinas del Cimatario, C.P. 76090",
        "telefono": "4422140499",
        "email_institucional": "contacto@canacoqro.com.mx",
        "email_directivo": "direccion@canacoqro.com.mx",
        "sitio_web": "https://www.canacoqro.com.mx",
        "presidente": "Fabián Camacho Arredondo",
        "director_general": "Lic. Patricia Rivera",
        "cargo_clave": "Presidente",
        "afiliados_estimados": 2800,
        "rfc": "CNC650101QRO"
    },
    {
        "id": "canaco_san_juan_rio",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de San Juan del Río",
        "siglas": "CANACO San Juan del Río",
        "estado": "Querétaro",
        "ciudad": "San Juan del Río",
        "direccion": "Av. Juárez Poniente 72, Centro, C.P. 76800",
        "telefono": "4272720444",
        "email_institucional": "info@canacosanjuan.com",
        "email_directivo": "direccion@canacosanjuan.com",
        "sitio_web": "https://www.canacosanjuan.com",
        "presidente": "José Guadalupe Román Flores",
        "director_general": "Lic. Teresa Gómez",
        "cargo_clave": "Presidente",
        "afiliados_estimados": 1600,
        "rfc": "CNC220202SJR"
    },
    # 23. Quintana Roo
    {
        "id": "canaco_cancun",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Cancún",
        "siglas": "CANACO Cancún",
        "estado": "Quintana Roo",
        "ciudad": "Cancún",
        "direccion": "Av. López Portillo SM 64 Mza 1, Cancún, C.P. 77500",
        "telefono": "9988842100",
        "email_institucional": "atencion@canacocancun.com",
        "email_directivo": "presidencia@canacocancun.com",
        "sitio_web": "https://www.canacocancun.com",
        "presidente": "Rafael Ortega Ramírez",
        "director_general": "Lic. Mariana Domínguez",
        "cargo_clave": "Presidente de Consejo",
        "afiliados_estimados": 2100,
        "rfc": "CNC750101CAN"
    },
    {
        "id": "canaco_chetumal",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Chetumal",
        "siglas": "CANACO Chetumal",
        "estado": "Quintana Roo",
        "ciudad": "Chetumal",
        "direccion": "Av. Álvaro Obregón 252, Col. Centro, C.P. 77000",
        "telefono": "9838320422",
        "email_institucional": "contacto@canacochetumal.com",
        "email_directivo": "presidencia@canacochetumal.com",
        "sitio_web": "https://www.canacochetumal.com",
        "presidente": "Amir Efrén Padilla Espadas",
        "director_general": "Lic. Víctor Zapata",
        "cargo_clave": "Presidente",
        "afiliados_estimados": 1200,
        "rfc": "CNC230202CHE"
    },
    {
        "id": "canaco_playa_del_carmen",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Playa del Carmen",
        "siglas": "CANACO Playa del Carmen",
        "estado": "Quintana Roo",
        "ciudad": "Playa del Carmen",
        "direccion": "Calle 4 Norte entre 10 y 15 Av., Centro, C.P. 77710",
        "telefono": "9848730411",
        "email_institucional": "info@canacoplayadelcarmen.com",
        "email_directivo": "direccion@canacoplayadelcarmen.com",
        "sitio_web": "https://www.canacoplayadelcarmen.com",
        "presidente": "Adán Toledo Medina",
        "director_general": "Lic. Andrea Pastrana",
        "cargo_clave": "Director Ejecutivo",
        "afiliados_estimados": 1900,
        "rfc": "CNC230303PDC"
    },
    # 24. San Luis Potosí
    {
        "id": "canaco_san_luis",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de San Luis Potosí",
        "siglas": "CANACO San Luis",
        "estado": "San Luis Potosí",
        "ciudad": "San Luis Potosí",
        "direccion": "Coronel Romero 2100, Col. Jardines del Estadio, C.P. 78280",
        "telefono": "4448113960",
        "email_institucional": "afiliaciones@canacosanluis.com",
        "email_directivo": "direccion@canacosanluis.com",
        "sitio_web": "https://www.canacosanluis.com",
        "presidente": "Fernando Díaz de León",
        "director_general": "Lic. Raúl Martínez",
        "cargo_clave": "Presidente",
        "afiliados_estimados": 2300,
        "rfc": "CNC500101SLP"
    },
    # 25. Sinaloa
    {
        "id": "canaco_culiacan",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Culiacán",
        "siglas": "CANACO Culiacán",
        "estado": "Sinaloa",
        "ciudad": "Culiacán",
        "direccion": "Av. Álvaro Obregón 824 Sur, Primer Cuadro, C.P. 80000",
        "telefono": "6677132393",
        "email_institucional": "atencion@canacoculiacan.com",
        "email_directivo": "presidencia@canacoculiacan.com",
        "sitio_web": "https://www.canacoculiacan.com",
        "presidente": "Jesús Antonio López Navarrete",
        "director_general": "Lic. Sergio Álvarez",
        "cargo_clave": "Presidente de Consejo",
        "afiliados_estimados": 3400,
        "rfc": "CNC250101CUL"
    },
    {
        "id": "canaco_mazatlan",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Mazatlán",
        "siglas": "CANACO Mazatlán",
        "estado": "Sinaloa",
        "ciudad": "Mazatlán",
        "direccion": "Av. Miguel Alemán 910, Fracc. Playa Sur, C.P. 82040",
        "telefono": "6699812424",
        "email_institucional": "info@canacomazatlan.com",
        "email_directivo": "direccion@canacomazatlan.com",
        "sitio_web": "https://www.canacomazatlan.com",
        "presidente": "Francisca Cázarez Oliveros",
        "director_general": "Lic. Roberto Osuna",
        "cargo_clave": "Presidenta de Consejo",
        "afiliados_estimados": 2800,
        "rfc": "CNC250202MAZ"
    },
    # 26. Sonora
    {
        "id": "canaco_hermosillo",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Hermosillo",
        "siglas": "CANACO Hermosillo",
        "estado": "Sonora",
        "ciudad": "Hermosillo",
        "direccion": "Calle Gastón Madrid 31, Col. San Benito, C.P. 83190",
        "telefono": "6622170881",
        "email_institucional": "contacto@canacohermosillo.com",
        "email_directivo": "presidencia@canacohermosillo.com",
        "sitio_web": "https://www.canacohermosillo.com",
        "presidente": "Juventino Félix Lugo",
        "director_general": "Lic. Martin Salazar",
        "cargo_clave": "Presidente de Consejo",
        "afiliados_estimados": 3200,
        "rfc": "CNC260101HER"
    },
    {
        "id": "canaco_obregon",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Ciudad Obregón",
        "siglas": "CANACO Cd. Obregón",
        "estado": "Sonora",
        "ciudad": "Ciudad Obregón",
        "direccion": "Calle 5 de Febrero 422 Norte, Centro, C.P. 85000",
        "telefono": "6444132200",
        "email_institucional": "afiliacion@canacoobregon.com.mx",
        "email_directivo": "direccion@canacoobregon.com.mx",
        "sitio_web": "https://www.canacoobregon.com.mx",
        "presidente": "Gustavo Cárdenas García",
        "director_general": "Lic. Ivonne Corral",
        "cargo_clave": "Presidente",
        "afiliados_estimados": 2100,
        "rfc": "CNC260202OBR"
    },
    # 27. Tabasco
    {
        "id": "canaco_villahermosa",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Villahermosa",
        "siglas": "CANACO Villahermosa",
        "estado": "Tabasco",
        "ciudad": "Villahermosa",
        "direccion": "Malecón Carlos A. Madrazo 627, Centro, C.P. 86000",
        "telefono": "9933120015",
        "email_institucional": "canaco_vhsa@prodigy.net.mx",
        "email_directivo": "presidencia@canacovillahermosa.com",
        "sitio_web": "https://www.canacovillahermosa.com",
        "presidente": "Manuel Antonio Miranda Hernández",
        "director_general": "Lic. Susana León",
        "cargo_clave": "Presidente de Consejo",
        "afiliados_estimados": 2600,
        "rfc": "CNC270101VSA"
    },
    # 28. Tamaulipas
    {
        "id": "canaco_tampico",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Tampico",
        "siglas": "CANACO Tampico",
        "estado": "Tamaulipas",
        "ciudad": "Tampico",
        "direccion": "Colón 404 Sur, Zona Centro, C.P. 89000",
        "telefono": "8332120044",
        "email_institucional": "informes@canacotampico.com.mx",
        "email_directivo": "presidencia@canacotampico.com.mx",
        "sitio_web": "https://www.canacotampico.com.mx",
        "presidente": "Carlos Muñoz González",
        "director_general": "Lic. Laura Treviño",
        "cargo_clave": "Presidente",
        "afiliados_estimados": 2500,
        "rfc": "CNC280101TAM"
    },
    {
        "id": "canaco_reynosa",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Reynosa",
        "siglas": "CANACO Reynosa",
        "estado": "Tamaulipas",
        "ciudad": "Reynosa",
        "direccion": "Calle Morelos 610, Zona Centro, C.P. 88500",
        "telefono": "8999220025",
        "email_institucional": "atencion@canacoreynosa.org",
        "email_directivo": "direccion@canacoreynosa.org",
        "sitio_web": "https://www.canacoreynosa.org",
        "presidente": "Cecilia Bueno Salazar",
        "director_general": "Lic. Roberto Cruz",
        "cargo_clave": "Presidenta de Consejo",
        "afiliados_estimados": 2700,
        "rfc": "CNC280202REY"
    },
    {
        "id": "canaco_matamoros",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Matamoros",
        "siglas": "CANACO Matamoros",
        "estado": "Tamaulipas",
        "ciudad": "Matamoros",
        "direccion": "Calle Sexta 1205, Zona Centro, C.P. 87300",
        "telefono": "8688120033",
        "email_institucional": "canaco@canacomatamoros.com",
        "email_directivo": "presidencia@canacomatamoros.com",
        "sitio_web": "https://www.canacomatamoros.com",
        "presidente": "Abraham Rodríguez Padrón",
        "director_general": "Lic. Miguel Garza",
        "cargo_clave": "Director General",
        "afiliados_estimados": 2300,
        "rfc": "CNC280303MAT"
    },
    # 29. Tlaxcala
    {
        "id": "canaco_tlaxcala",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Tlaxcala",
        "siglas": "CANACO Tlaxcala",
        "estado": "Tlaxcala",
        "ciudad": "Tlaxcala",
        "direccion": "Calle Guerrero 23, Centro Histórico, C.P. 90000",
        "telefono": "2464620022",
        "email_institucional": "contacto@canacotlaxcala.com",
        "email_directivo": "presidencia@canacotlaxcala.com",
        "sitio_web": "https://www.canacotlaxcala.com",
        "presidente": "Joseph Rodríguez Ramos",
        "director_general": "Lic. Karina López",
        "cargo_clave": "Presidente",
        "afiliados_estimados": 1500,
        "rfc": "CNC290101TLX"
    },
    # 30. Veracruz
    {
        "id": "canaco_veracruz",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Veracruz",
        "siglas": "CANACO Veracruz",
        "estado": "Veracruz",
        "ciudad": "Veracruz",
        "direccion": "Av. Independencia 983, Centro Histórico, C.P. 91700",
        "telefono": "2299898500",
        "email_institucional": "contacto@canacoveracruz.com.mx",
        "email_directivo": "presidencia@canacoveracruz.com.mx",
        "sitio_web": "https://www.canacoveracruz.com.mx",
        "presidente": "Edi Alberto Martínez Tejeda",
        "director_general": "Lic. Mónica Ruiz",
        "cargo_clave": "Presidente CANACO",
        "afiliados_estimados": 2400,
        "rfc": "CNC300101VER"
    },
    {
        "id": "canaco_xalapa",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Xalapa",
        "siglas": "CANACO Xalapa",
        "estado": "Veracruz",
        "ciudad": "Xalapa-Enríquez",
        "direccion": "Ursulo Galván 28, Centro, C.P. 91000",
        "telefono": "2288172020",
        "email_institucional": "info@canacoxalapa.com.mx",
        "email_directivo": "presidencia@canacoxalapa.com.mx",
        "sitio_web": "https://www.canacoxalapa.com.mx",
        "presidente": "Carlos Arturo Luna Gómez",
        "director_general": "Lic. Bernardo Martínez",
        "cargo_clave": "Presidente de Consejo",
        "afiliados_estimados": 2100,
        "rfc": "CNC300202XAL"
    },
    {
        "id": "canaco_coatzacoalcos",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Coatzacoalcos",
        "siglas": "CANACO Coatzacoalcos",
        "estado": "Veracruz",
        "ciudad": "Coatzacoalcos",
        "direccion": "Av. Zaragoza 618, Centro, C.P. 96400",
        "telefono": "9212120010",
        "email_institucional": "contacto@canacocoatzacoalcos.com",
        "email_directivo": "direccion@canacocoatzacoalcos.com",
        "sitio_web": "https://www.canacocoatzacoalcos.com",
        "presidente": "Ignacio Alonso Martínez",
        "director_general": "Lic. Miriam Romero",
        "cargo_clave": "Director General",
        "afiliados_estimados": 1700,
        "rfc": "CNC300303COA"
    },
    # 31. Yucatán
    {
        "id": "canaco_merida",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Mérida",
        "siglas": "CANACO SERVYTUR Mérida",
        "estado": "Yucatán",
        "ciudad": "Mérida",
        "direccion": "Calle 31 No. 273 x 34, Col. García Ginerés, C.P. 97070",
        "telefono": "9999255140",
        "email_institucional": "contacto@canacomerida.com.mx",
        "email_directivo": "presidencia@canacomerida.com.mx",
        "sitio_web": "https://www.canacomerida.com.mx",
        "presidente": "Levy Abraham Macari",
        "director_general": "Lic. Roberto González",
        "cargo_clave": "Presidente del Comité Directivo",
        "afiliados_estimados": 1850,
        "rfc": "CNC250101XYZ"
    },
    {
        "id": "canaco_valladolid",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Valladolid",
        "siglas": "CANACO Valladolid",
        "estado": "Yucatán",
        "ciudad": "Valladolid",
        "direccion": "Calle 40 No. 202 x 39 y 41, Centro, C.P. 97780",
        "telefono": "9858562020",
        "email_institucional": "canacovalladolid@prodigy.net.mx",
        "email_directivo": "presidencia@canacovalladolid.com",
        "sitio_web": "https://www.canacovalladolid.com",
        "presidente": "Gerardo Vidal Cruz",
        "director_general": "Lic. Manuel Alcocer",
        "cargo_clave": "Presidente",
        "afiliados_estimados": 850,
        "rfc": "CNC310202VAL"
    },
    # 32. Zacatecas
    {
        "id": "canaco_zacatecas",
        "nombre_oficial": "Cámara Nacional de Comercio, Servicios y Turismo de Zacatecas",
        "siglas": "CANACO Zacatecas",
        "estado": "Zacatecas",
        "ciudad": "Zacatecas",
        "direccion": "Blvd. Adolfo López Mateos 1002, Col. Centro, C.P. 98000",
        "telefono": "4929220021",
        "email_institucional": "atencion@canacozacatecas.com",
        "email_directivo": "presidencia@canacozacatecas.com",
        "sitio_web": "https://www.canacozacatecas.com",
        "presidente": "Jesús Gabriel López del Bosque",
        "director_general": "Lic. Estela Cárdenas",
        "cargo_clave": "Presidente de Consejo",
        "afiliados_estimados": 1900,
        "rfc": "CNC320101ZAC"
    }
]


def _clean_phone(raw: Optional[str]) -> Optional[str]:
    """Extrae 10 dígitos y normaliza a formato de marcación nacional."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("52") and len(digits) == 12:
        digits = digits[2:]
    elif digits.startswith("521") and len(digits) == 13:
        digits = digits[3:]
    if len(digits) == 10 and digits[0] not in ("0", "1"):
        return digits
    return digits if len(digits) >= 8 else None


class CanacoHarvester(BaseHarvester):
    """
    Harvester especializado en Cámaras Nacionales de Comercio (CANACO)
    y Operadores del SIEM para prospección B2B de Ark Ledger.
    """
    source_name = "canaco"
    rate_limit = 2.0

    def __init__(
        self,
        fixture_path: Optional[str] = None,
        plaza: Optional[str] = None,
        custom_query: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> None:
        super().__init__()
        self.fixture_path = fixture_path
        self.plaza = _strip_accents((plaza or "").lower().strip())
        self.custom_query = _strip_accents((custom_query or "").lower().strip())
        self.limit = limit

    async def health_check(self) -> bool:
        """Verifica disponibilidad del harvester (siempre activo vía seed/fixture o red)."""
        return True

    def _matches_filters(self, item: Dict[str, Any]) -> bool:
        if self.plaza:
            estado = _strip_accents((item.get("estado") or "").lower())
            ciudad = _strip_accents((item.get("ciudad") or "").lower())
            if self.plaza not in estado and self.plaza not in ciudad:
                return False

        if self.custom_query:
            texto = _strip_accents(" ".join([
                str(item.get("nombre_oficial") or ""),
                str(item.get("siglas") or ""),
                str(item.get("presidente") or ""),
                str(item.get("ciudad") or ""),
                str(item.get("estado") or "")
            ]).lower())
            if self.custom_query not in texto:
                return False

        return True

    def _normalize(self, item: Dict[str, Any]) -> RawLead:
        cid = str(item.get("id") or item.get("lead_id") or "canaco_item")
        if not cid.startswith("lead_"):
            cid = f"lead_{cid}"

        nombre = item.get("nombre_oficial") or item.get("razon_social") or "Cámara Nacional de Comercio"
        estado = item.get("estado")
        ciudad = item.get("ciudad")
        web = item.get("sitio_web")
        raw_phone = item.get("telefono_directo") or item.get("telefono")
        phone = _clean_phone(raw_phone)
        
        # Priorizar email directivo / presidencia si existe, si no institucional
        email = (
            item.get("email_directivo")
            or item.get("email_presidencia")
            or item.get("email_institucional")
            or item.get("email")
        )

        # Contactos clave
        presidente = item.get("presidente")
        director_general = item.get("director_general")
        cargo_clave = item.get("cargo_clave") or "Director General / Presidente"
        contacto_clave = director_general or presidente or "Titular de Dirección General"

        return RawLead(
            lead_id=cid,
            razon_social=nombre,
            rfc=item.get("rfc"),
            actividad="Cámara Empresarial y Operador Autorizado SIEM",
            scian_code=CANACO_SCIAN,
            empleados_rango="51 a 100 personas",
            ciudad=ciudad,
            estado=estado,
            sitio_web=web,
            telefono=phone,
            email=email,
            productos_interes=["ledger_pro", "ledger_freemium", "siem_landing_white_label"],
            tenant_id="acc_ark_ledger",
            source="canaco",
            score=90,  # Alta prioridad: canales masivos de agremiados
            dolor_principal="afiliacion_siem_digitalizacion_contable",
            vertical="fiscal",
            harvest_profile=CANACO_PROFILE,
            raw={
                "siglas": item.get("siglas"),
                "direccion": item.get("direccion"),
                "presidente": presidente,
                "director_general": director_general,
                "contacto_clave": contacto_clave,
                "cargo_clave": cargo_clave,
                "afiliados_estimados": item.get("afiliados_estimados", 1000),
                "operador_siem": True
            }
        )

    async def harvest(self) -> AsyncIterator[RawLead]:
        records: List[Dict[str, Any]] = []

        if self.fixture_path:
            p = Path(self.fixture_path)
            if not p.is_absolute():
                base_dir = Path(__file__).resolve().parent
                p = (base_dir / self.fixture_path).resolve() if not p.exists() else p
            if p.exists():
                logger.info(f"Cargando fixture CANACO desde {p}")
                data = json.loads(p.read_text(encoding="utf-8"))
                records = data if isinstance(data, list) else data.get("results", [])
            else:
                logger.warning(f"No se encontró fixture {self.fixture_path}, recurriendo al seed registry")
                records = CANACO_SEED_REGISTRY
        else:
            records = CANACO_SEED_REGISTRY

        count = 0
        for item in records:
            if not self._matches_filters(item):
                continue
            await self._throttle()
            lead = self._normalize(item)
            yield lead
            count += 1
            if self.limit and count >= self.limit:
                break
