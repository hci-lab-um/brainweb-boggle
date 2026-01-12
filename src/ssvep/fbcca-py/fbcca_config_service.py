import sys
import json
import os
import math


def _find_fbcca_config_path():
    """Locate fbccaConfig.json in both dev and packaged layouts.

    Search order:
    1. FBCCA_CONFIG_PATH environment variable (if set and valid)
    2. Dev layout: <repo_root>/configs/fbccaConfig.json
    3. Packaged layout: <resources>/app/configs/fbccaConfig.json
    """

    # 1) Explicit override via environment variable
    env_path = os.environ.get("FBCCA_CONFIG_PATH")
    if env_path and os.path.isfile(env_path):
        return env_path

    script_dir = os.path.dirname(os.path.abspath(__file__))

    # 2) Development layout: .../<repo_root>/configs/fbccaConfig.json
    #   script_dir = <repo_root>/src/ssvep/fbcca-py
    #   -> repo_root = script_dir/../../..
    dev_root = os.path.dirname(os.path.dirname(os.path.dirname(script_dir)))
    dev_path = os.path.join(dev_root, "configs", "fbccaConfig.json")
    if os.path.isfile(dev_path):
        return dev_path

    # 3) Packaged layout (electron-builder):
    #   script_dir = <install>/resources/ssvep/fbcca-py
    #   resources_root = script_dir/../..
    #   config lives at   <install>/resources/app/configs/fbccaConfig.json
    resources_root = os.path.dirname(os.path.dirname(script_dir))
    packaged_path = os.path.join(resources_root, "app", "configs", "fbccaConfig.json")
    if os.path.isfile(packaged_path):
        return packaged_path

    return None


def load_fbcca_config():
    config_path = _find_fbcca_config_path()

    if not config_path:
        print("Error: Could not locate fbccaConfig.json in any known location", file=sys.stderr)
        return None

    try:
        with open(config_path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: Could not find fbccaConfig.json at {config_path}", file=sys.stderr)
        return None
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in fbccaConfig.json: {e}", file=sys.stderr)
        return None


fbcca_config = load_fbcca_config()


def total_data_point_count():
    return math.ceil(fbcca_config["samplingRate"] * fbcca_config["gazeLengthInSecs"])