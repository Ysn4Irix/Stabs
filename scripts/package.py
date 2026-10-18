import os
import json
import zipfile
import sys

def build_extension_package():
    if not os.path.exists('manifest.json'):
        print('Error: manifest.json not found.')
        sys.exit(1)

    with open('manifest.json', 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    version = manifest.get('version', '1.0.0')
    name = 'stabs'
    os.makedirs('dist', exist_ok=True)

    zip_filename = f'dist/{name}-v{version}.zip'

    include_files = [
        'manifest.json',
        'background/service-worker.js',
        'lib/device.js',
        'lib/snapshot.js',
        'lib/telegram.js',
        'lib/restorer.js',
        'popup/popup.html',
        'popup/popup.css',
        'popup/popup.js',
        'icons/icon-16.png',
        'icons/icon-48.png',
        'icons/icon-128.png'
    ]

    missing = []
    for file_path in include_files:
        if not os.path.exists(file_path):
            missing.append(file_path)

    if missing:
        print(f'Error: Missing required files for release package: {missing}')
        sys.exit(1)

    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zf:
        for file_path in include_files:
            # Normalize path separators for cross-platform compatibility
            archive_name = file_path.replace('\\', '/')
            zf.write(file_path, arcname=archive_name)

    size_kb = os.path.getsize(zip_filename) / 1024
    print(f'Successfully built {zip_filename} ({size_kb:.1f} KB, {len(include_files)} files).')
    return zip_filename

if __name__ == '__main__':
    build_extension_package()
