import sys
import json
import os
import math

def load_fbcca_config():
    # Get the root directory of the project (3 levels up from current script)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(script_dir)))
    config_path = os.path.join(project_root, 'configs', 'fbccaConfig.json')
    
    try:
        with open(config_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: Could not find fbccaConfig.json at {config_path}", file=sys.stderr)
        return None
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in fbccaConfig.json: {e}", file=sys.stderr)
        return None
    
fbcca_config = load_fbcca_config()
    
def total_data_point_count():
    return math.ceil(fbcca_config['samplingRate'] * fbcca_config['gazeLengthInSecs'])