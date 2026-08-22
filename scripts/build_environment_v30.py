from pathlib import Path
import json
import shutil
import struct
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'v30' / 'environment'

LIGHT_ARCHIVES = [
    'Small_dark_fantasy_gothic_dung.zip',
    'Small_dark_fantasy_gothic_dung 1.zip',
    'Small_dark_fantasy_gothic_dung 2.zip',
]
BACKGROUND_ARCHIVES = [
    f'Small_dark_fantasy_gothic_dung {index}.zip' for index in range(3, 15)
]
ARCH_ARCHIVES = [
    'Gothic_stone_arch_and_pillar_c.zip',
    'Gothic_stone_arch_and_pillar_c 1.zip',
    'Gothic_stone_arch_and_pillar_c 2.zip',
    'Gothic_stone_arch_and_pillar_c 3.zip',
    'Gothic_stone_arch_and_pillar_c 4.zip',
]

GROUPS = {
    'lights': LIGHT_ARCHIVES,
    'background': BACKGROUND_ARCHIVES,
    'arches': ARCH_ARCHIVES,
}

PNG_SIGNATURE = b'\x89PNG\r\n\x1a\n'


def fail(message):
    raise SystemExit(f'V30 ENVIRONMENT BUILD FAILED: {message}')


def png_dimensions(data):
    if len(data) < 24 or data[:8] != PNG_SIGNATURE or data[12:16] != b'IHDR':
        fail('selected object is not a valid PNG')
    return struct.unpack('>II', data[16:24])


def choose_static_png(archive_path):
    with zipfile.ZipFile(archive_path) as archive:
        candidates = []
        for info in archive.infolist():
            if info.is_dir():
                continue
            name = info.filename.replace('\\', '/')
            lower = name.lower()
            if '__macosx' in lower or not lower.endswith('.png'):
                continue
            score = 0
            if '/rotations/' in lower:
                score += 1000
            if '/animations/' in lower:
                score -= 150
            if Path(name).name.lower().startswith('frame_'):
                score -= 50
            score += min(100, info.file_size // 256)
            candidates.append((score, info.file_size, name))
        if not candidates:
            fail(f'{archive_path.name} contains no usable PNG files')
        candidates.sort(reverse=True)
        selected = candidates[0][2]
        data = archive.read(selected)
    return selected, data


def build_group(group, archives):
    destination = OUT / group
    destination.mkdir(parents=True, exist_ok=True)
    records = []
    for index, archive_name in enumerate(archives):
        archive_path = ROOT / archive_name
        if not archive_path.exists():
            fail(f'missing source archive: {archive_name}')
        source_entry, data = choose_static_png(archive_path)
        width, height = png_dimensions(data)
        output_name = f'{group}_{index:02d}.png'
        output_path = destination / output_name
        output_path.write_bytes(data)
        records.append({
            'id': f'{group}_{index:02d}',
            'path': str(output_path.relative_to(ROOT)).replace('\\', '/'),
            'sourceArchive': archive_name,
            'sourceEntry': source_entry,
            'width': width,
            'height': height,
        })
        print(f'{group}[{index:02d}] {archive_name} -> {source_entry} ({width}x{height})')
    return records


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True, exist_ok=True)

    manifest = {group: build_group(group, archives) for group, archives in GROUPS.items()}
    manifest['terrain'] = {
        'foreground': 'pixellab-tileset-solid-ancient-gothic-fortress-stone-platform-flat-walkable-g-e686e8eb.png',
        'background': 'pixellab-tileset-ancient-recessed-gothic-dungeon-wall-masonry-965b1f4b.png',
        'architecture': 'pixellab-tileset-ancient-gothic-stone-pillar-and-arch-masonry-919c3a88.png',
    }
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')

    expected = {'lights': 3, 'background': 12, 'arches': 5}
    for group, count in expected.items():
        if len(manifest[group]) != count:
            fail(f'{group} output count changed: {len(manifest[group])} != {count}')
    print('V30 environment assets built: 3 lights, 12 background objects, 5 arch objects.')


if __name__ == '__main__':
    main()
