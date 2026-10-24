# scripts/python/forge_ark_pulse_texture.py
# Genera una textura de fondo "Neural Fiscal Grid" para propuestas PDF, dashboards y landings.
# Requiere: Pillow (pip install Pillow)

from PIL import Image, ImageDraw
import random
import math

def generate_neural_fiscal_grid(width=1200, height=800, output_path="ark_pulse_bg.png"):
    # 1. Fondo Base (Slate-950)
    bg_color = "#020617"
    grid_color = "#1e293b"  # Slate-800 muy sutil
    node_color = "#3b82f6"  # Blue-500
    active_node_color = "#10b981" # Emerald-500
    
    img = Image.new("RGB", (width, height), bg_color)
    draw = ImageDraw.Draw(img)
    
    # 2. Dibujar Cuadrícula Fiscal (Precisión)
    spacing = 40
    for x in range(0, width, spacing):
        draw.line([(x, 0), (x, height)], fill=grid_color, width=1)
    for y in range(0, height, spacing):
        draw.line([(0, y), (width, y)], fill=grid_color, width=1)
        
    # 3. Generar Nodos Agénticos (Conexiones D1 -> Queue -> Workers)
    num_nodes = 25
    nodes = []
    
    # Generar posiciones aleatorias pero con cierta estructura
    for _ in range(num_nodes):
        x = random.randint(0, width)
        y = random.randint(0, height)
        # Asegurar que estén alineados a la cuadrícula para el look "técnico"
        x = (x // spacing) * spacing
        y = (y // spacing) * spacing
        nodes.append((x, y))
        
    # 4. Dibujar Conexiones (Tool Calling / Routing)
    for i, (x1, y1) in enumerate(nodes):
        # Conectar cada nodo con los 2-3 nodos más cercanos
        distances = []
        for j, (x2, y2) in enumerate(nodes):
            if i != j:
                dist = math.sqrt((x2 - x1)**2 + (y2 - y1)**2)
                distances.append((dist, j))
        
        distances.sort(key=lambda item: item[0])
        
        # Conectar con los 2 más cercanos si están a una distancia razonable
        for dist, j in distances[:2]:
            if dist < 300:
                x2, y2 = nodes[j]
                # Línea sutil
                draw.line([(x1, y1), (x2, y2)], fill="#334155", width=1)
                
    # 5. Dibujar Nodos (Puntos de decisión del Agente)
    for i, (x, y) in enumerate(nodes):
        # El primer nodo es el "Closer" (Bundle), lo hacemos destacado (Ámbar)
        if i == 0:
            draw.ellipse([(x-6, y-6), (x+6, y+6)], fill="#f59e0b") # Amber-500
            # Glow sutil
            draw.ellipse([(x-12, y-12), (x+12, y+12)], outline="#f59e0b", width=1)
        else:
            # Nodos estándar (Azul o Esmeralda)
            color = active_node_color if random.random() > 0.7 else node_color
            draw.ellipse([(x-3, y-3), (x+3, y+3)], fill=color)

    # 6. Guardar optimizado
    img.save(output_path, "PNG", optimize=True, compress_level=9)
    print(f"✅ Textura ARK PULSE generada: {output_path}")

if __name__ == "__main__":
    generate_neural_fiscal_grid()
