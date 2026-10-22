import zlib
import struct
import math

def create_png(width, height, draw_fn, output_path):
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0)  # filter type 0 (None)
        for x in range(width):
            r, g, b, a = draw_fn(x, y, width, height)
            raw_data.extend([r, g, b, a])
            
    def make_chunk(chunk_type, data):
        crc = zlib.crc32(chunk_type + data) & 0xffffffff
        return struct.pack('>I', len(data)) + chunk_type + data + struct.pack('>I', crc)

    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    compressed = zlib.compress(bytes(raw_data), level=9)
    
    png_bytes = b'\x89PNG\r\n\x1a\n'
    png_bytes += make_chunk(b'IHDR', ihdr)
    png_bytes += make_chunk(b'IDAT', compressed)
    png_bytes += make_chunk(b'IEND', b'')

    with open(output_path, 'wb') as f:
        f.write(png_bytes)

def draw_standard(x, y, w, h):
    # Normalized coords [0, 1]
    nx = x / float(w)
    ny = y / float(h)
    
    # Rounded rectangle background
    # rx = 0.22
    corner_r = 0.22
    in_bg = True
    
    # Check corner radii
    cx = 0.5
    cy = 0.5
    
    # Distance from corners
    dx = max(0.0, abs(nx - 0.5) - (0.5 - corner_r))
    dy = max(0.0, abs(ny - 0.5) - (0.5 - corner_r))
    dist_sq = dx*dx + dy*dy
    if dist_sq > corner_r * corner_r:
        return 0, 0, 0, 0 # Transparent outside rounded corner
        
    # Brand green: #0e6b4f -> (14, 107, 79)
    # Check if inside golden basket/leaf symbol
    # Centered at (0.5, 0.53)
    # Leaf curve
    lx = (nx - 0.5)
    ly = (ny - 0.53)
    
    # Basket body: ellipse/bowl shape
    # Bowl: y between 0.05 and 0.22, abs(x) < 0.28 * (1.0 - (ly - 0.05)/0.35)
    in_basket = False
    if 0.0 <= ly <= 0.20:
        bw = 0.24 - (ly * 0.3)
        if abs(lx) <= bw:
            in_basket = True

    # Zap / Leaf upper curve:
    # A circle at (-0.05, -0.05) with r=0.20
    d_circ = (lx + 0.04)**2 + (ly + 0.04)**2
    if d_circ <= 0.038 and (ly < 0.02 or lx > -0.02):
        in_basket = True

    # Spark / speed streak at top right:
    # Arc or line from (0.02, -0.22) to (-0.02, -0.08)
    # Distance to line segment
    sx = lx - 0.06
    sy = ly + 0.16
    if abs(sx) < 0.035 and abs(sy) < 0.08:
        return 255, 253, 248, 255 # White streak #fffdf8

    if in_basket:
        # Golden zest: #f0b429 -> (240, 180, 41)
        return 240, 180, 41, 255

    # Darker leaf accent shadow
    if ly > 0.38:
        return 10, 61, 46, 255

    return 14, 107, 79, 255

def draw_maskable(x, y, w, h):
    nx = x / float(w)
    ny = y / float(h)
    
    # Full bleed background #0e6b4f
    # Inner symbol scaled to 70% safe zone
    lx = (nx - 0.5) / 0.75
    ly = (ny - 0.52) / 0.75
    
    in_basket = False
    if 0.0 <= ly <= 0.20:
        bw = 0.24 - (ly * 0.3)
        if abs(lx) <= bw:
            in_basket = True

    d_circ = (lx + 0.04)**2 + (ly + 0.04)**2
    if d_circ <= 0.038 and (ly < 0.02 or lx > -0.02):
        in_basket = True

    sx = lx - 0.06
    sy = ly + 0.16
    if abs(sx) < 0.035 and abs(sy) < 0.08:
        return 255, 253, 248, 255

    if in_basket:
        return 240, 180, 41, 255

    return 14, 107, 79, 255

create_png(192, 192, draw_standard, 'frontend/public/icon-192.png')
create_png(512, 512, draw_standard, 'frontend/public/icon-512.png')
create_png(180, 180, draw_standard, 'frontend/public/apple-touch-icon.png')
create_png(512, 512, draw_maskable, 'frontend/public/icon-maskable-512.png')

print("Icons generated successfully!")
