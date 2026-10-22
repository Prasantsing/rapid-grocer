import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate_pngs import create_png, draw_standard, draw_maskable

res_dir = 'android/app/src/main/res'
densities = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
}

for folder, size in densities.items():
    folder_path = os.path.join(res_dir, folder)
    os.makedirs(folder_path, exist_ok=True)
    # Launcher icon
    create_png(size, size, draw_standard, os.path.join(folder_path, 'ic_launcher.png'))
    create_png(size, size, draw_standard, os.path.join(folder_path, 'ic_launcher_round.png'))
    # Foreground for adaptive icon
    create_png(size, size, draw_maskable, os.path.join(folder_path, 'ic_launcher_foreground.png'))
    print(f"Generated {folder} ({size}x{size})")

print("All Android launcher icons generated successfully!")
