from pathlib import Path
from PIL import Image
import math
import sys

ICON_SIZE = 64
PADDING = 1
CELL_SIZE = ICON_SIZE + PADDING * 2
OUTPUT_NAME = "!spritesheet.png"

if len(sys.argv) != 2:
    print("Usage:")
    print("  python buildSpritesheet.py <icon_folder>")
    sys.exit(1)

folder = Path(sys.argv[1])

if not folder.exists():
    raise FileNotFoundError(folder)

files = []

for file in folder.glob("*.png"):
    if file.name == OUTPUT_NAME:
        continue

    try:
        number = int(file.stem)
        files.append((number, file))
    except ValueError:
        pass

files.sort(key=lambda x: x[0])

count = len(files)

if count == 0:
    print("No numbered PNG files found.")
    raise SystemExit

icons_per_side = math.ceil(math.sqrt(count))

sheet = Image.new(
    "RGBA",
    (
        icons_per_side * CELL_SIZE,
        icons_per_side * CELL_SIZE
    ),
    (0, 0, 0, 0)
)

for index, (_, file) in enumerate(files):

    img = Image.open(file).convert("RGBA")

    if img.size != (ICON_SIZE, ICON_SIZE):
        raise ValueError(
            f"{file.name} is {img.size}, expected {(ICON_SIZE, ICON_SIZE)}"
        )

    x = (index % icons_per_side) * CELL_SIZE + PADDING
    y = (index // icons_per_side) * CELL_SIZE + PADDING

    sheet.paste(img, (x, y))

output = folder / OUTPUT_NAME
sheet.save(output)

print(f"Built {OUTPUT_NAME}")
print(f"Icons: {count}")
print(f"Grid: {icons_per_side} x {icons_per_side}")
print(f"Size: {sheet.width} x {sheet.height}")