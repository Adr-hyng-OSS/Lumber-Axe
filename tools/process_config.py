import json, argparse

import hashlib
import os
import re
import shutil
import time

parser = argparse.ArgumentParser(description='Build config file from configuration_settings.json')
parser.add_argument('--target', choices=['release', 'debug', 'server'], default='debug', help='Whether to build the addon in debug or release mode or for servers')
parser.add_argument('--watch', '-w', action='store_true', help='Watch config.js and wordedit_settings.json for changes and update')
parser.add_argument('--generateConfigTS', action='store_true', help='Generate/update config.ts in the src folder')
parser.add_argument('--generateConfigJSON', action='store_true', help='Generate/update variables.json in the builds folder')
args = parser.parse_args()

settings = {
    "debug": {
        "description": "Enables debug messages to content logs.",
        "name": "Debug Mode",
        "default": args.target == 'debug'
    }
}
version_str = ''
configuration_path = "configuration";

def compute_hash(filename):
    with open(filename, 'rb') as f:
        file_hash = hashlib.sha256()
        while chunk := f.read(8192):
            file_hash.update(chunk)
    return file_hash.hexdigest()


def generateScript(isServer):
    result = ''
    if isServer:
        result += 'import { variables } from "@minecraft/server-admin";\n\n'
    result += 'import { FormBuilder } from "utils/form_builder";\n'
    result += 'import { cloneConfiguration } from "./configuration_handler";\n\n'
    result += 'export const serverConfiguration = {\n'
    for name, data in settings.items():
        if isServer:
            result += f'  {name}: variables.get("{name}"),\n'
        else:
            value = data["default"]
            form_name = data["name"]

            if type(value) is str or type(value) is int:
                value = f'new FormBuilder("{form_name}").createTextField("{value}")'
            elif type(value) is bool:
                value = f'new FormBuilder("{form_name}").createToggle(true)' if value else f'new FormBuilder("{form_name}").createToggle(false)'
            elif type(value) is list:
                if len(value) > 0:
                    list_representation = repr(value)
                    value = f'new FormBuilder("{form_name}").createDropdown({list_representation}, "{value[0]}")'
                else: 
                    value = f'new FormBuilder("{form_name}").createDropdown(["Empty"], "")'
            
            result += '  /**\n'
            for line in data['description'].splitlines():
                result += f'   * {line}\n'
            result += '   */\n'
            result += f'  {name}: {value},\n'
    result += '};\n\n'

    result += 'export let serverConfigurationCopy = cloneConfiguration(serverConfiguration);\n'
    result += 'export let setServerConfiguration = (newServerConfig) => serverConfigurationCopy = newServerConfig;\n'
    result += 'export let resetServerConfiguration = () => serverConfigurationCopy = cloneConfiguration(serverConfiguration);\n\n'
    result += '\n'.join([
        '// version (do not change)',
        f'export const VERSION = "{version_str}";'
    ])
    return result

def generateVariables():
    result = []
    for name, data in settings.items():
        value = data["default"]

        if type(value) is str:
            value = f'"{value}"'
        elif type(value) is bool:
            value = "true" if value else "false"
        
        var = '\n    /**\n'
        for line in data['description'].splitlines():
            var += f'     * {line}\n'
        var += '     */\n'
        var += f'    "{name}": {value}'
        result.append(var)
    return '{' + ",".join(result) + '\n}'

prevResult = ''

def update():
    global prevResult
    # Load settings from configuration_settings.json before updating
    load_settings()
    
    with open(f'src/{configuration_path}/server_configuration.ts', 'w') as file:
        file.write(generateScript(False))

    time.sleep(0.5)
    with open(f'BP/scripts/{configuration_path}/server_configuration.js', 'w') as file:
        prevResult = generateScript(args.target == 'server')
        file.write(prevResult)
    
        
def check_for_changes():
    settings_hash = compute_hash(f'src/configuration_settings.json')
    config_js_hash = compute_hash(f'BP/scripts/{configuration_path}/server_configuration.js')
    config_ts_hash = compute_hash(f'src/{configuration_path}/server_configuration.ts')

    try:
        with open(f'src/.config_hashes', 'r') as f:
            data = f.read().splitlines()
    except FileNotFoundError:
        data = ['', '', '']
        
    if data[0] == settings_hash and data[1] == config_js_hash:
        return False
    else:
        with open(f'src/.config_hashes', 'w') as f:
            f.write(f"{settings_hash}\n{config_js_hash}\n{config_ts_hash}\n")

        # Update config.js
        update()

        # Copy config.js to BP/scripts if not already there
        if not os.path.exists(f'BP/scripts/{configuration_path}/server_configuration.js'):
            shutil.copyfile(f'BP/scripts/{configuration_path}/server_configuration.js', f'BP/scripts/{configuration_path}/server_configuration.js')

        # Update config.ts
        with open(f'src/{configuration_path}/server_configuration.ts', 'r') as f:
            config_ts_content = f.read()
            with open(f'src/{configuration_path}/server_configuration.ts', 'w') as f:
                f.write(re.sub(r"const VERSION = .+;", f"const VERSION = \"{version_str}\";", config_ts_content))
        
        return True     
    

def load_settings():
    global settings
    try:
        os.utime(f'src/configuration_settings.json', None)
        with open(f'src/configuration_settings.json', 'r') as file:
            settings = {**json.load(file), **settings}
            
    except (FileNotFoundError, json.JSONDecodeError):
        # Handle the case where the file is empty or not valid JSON.
        print("Error: Unable to load settings from configuration_settings.json.")
    finally:
        # print(settings)
        pass

# load settings file
load_settings()

# load addon version
with open('setup/mc_manifest.json', 'r') as file:
    manifest = json.load(file)
    version = manifest['header']['version']

    if type(version) is str:
        version_str = version
    else:
        version_str = '.'.join(map(str, version)) + (' [BETA]' if len(version) > 3 else '')\

# Generate src/config.ts
if args.generateConfigTS:
    with open(f'src/{configuration_path}/server_configuration.ts', 'w') as file:
        file.write(generateScript(False))
    exit(0)

# Generate builds/variables.json
if args.generateConfigJSON:
    with open('builds/variables.json', 'w') as file:
        file.write(generateVariables())
    exit(0)

if args.watch:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    

    class MyHandler(FileSystemEventHandler):
        def on_modified(self, ev):
            if ev.src_path in ['src\\configuration_settings.json']:
                if check_for_changes():
                    print("Settings changed! Updating...")
    
    obsSettings = Observer()
    obsSettings.schedule(MyHandler(),  path='src')
    obsSettings.start()

    obsConfigJS = Observer()
    obsConfigJS.schedule(MyHandler(),  path='BP\\scripts')
    obsConfigJS.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        obsSettings.stop()
        obsConfigJS.stop()
    
    obsSettings.join()
    obsConfigJS.join()
else:
    update()