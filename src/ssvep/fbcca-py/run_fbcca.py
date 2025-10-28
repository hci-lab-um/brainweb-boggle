import sys
import json
import os
import numpy as np
from fbcca_config import fbcca_config
from test_fbcca import test_fbcca

# Load scenario configuration
def load_scenario_config():
    # Get the root directory of the project (3 levels up from current script)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(script_dir)))
    # config_path = os.path.join(project_root, 'configs', 'scenarioConfig.json')
    config_path = os.path.join(project_root, 'configs', 'scenarioConfig_lowFreqs.json')
    
    try:
        with open(config_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: Could not find scenarioConfig.json at {config_path}", file=sys.stderr)
        return None
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in scenarioConfig.json: {e}", file=sys.stderr)
        return None

# Load the scenario config at module level
scenario_config = load_scenario_config()

def run_fbcca(eeg, scenario_id):
    eeg_data = eeg[:, :fbcca_config.total_data_point_count()]
    stimuli_frequencies = get_stimuli_frequencies(scenario_id)
    
    if np.any(eeg_data != 0) and np.all(stimuli_frequencies != 0):
        freq_idx = test_fbcca(eeg_data, stimuli_frequencies)
        selected_button_id = get_selected_button_id(freq_idx, scenario_id)
    else:
        selected_button_id = fbcca_config.idleStateLabel
    
    return selected_button_id

def get_stimuli_frequencies(scenario_id):   
    if scenario_id != -1 and scenario_config:
        scenario_key = f"scenario_{scenario_id}"
        if scenario_key in scenario_config:
            stimuli_frequencies = scenario_config[scenario_key]['frequencies']
        else:
            print(f"Warning: Scenario {scenario_id} not found in config", file=sys.stderr)
            stimuli_frequencies = 0
    else:
        stimuli_frequencies = 0
    
    return stimuli_frequencies

def get_selected_button_id(freq_idx, scenario_id):
    if freq_idx != fbcca_config.idleStateLabel and scenario_config:
        scenario_key = f"scenario_{scenario_id}"
        if scenario_key in scenario_config and 'buttonIds' in scenario_config[scenario_key]:
            button_ids = scenario_config[scenario_key]['buttonIds']
            if freq_idx < len(button_ids):
                selected_button_id = button_ids[freq_idx]
            else:
                print(f"Warning: freq_idx {freq_idx} out of range for buttonIds", file=sys.stderr)
                selected_button_id = fbcca_config.idleStateLabel
        else:
            print(f"Warning: buttonIds not found for scenario {scenario_id}", file=sys.stderr)
            selected_button_id = fbcca_config.idleStateLabel
    else:
        selected_button_id = freq_idx
    
    return selected_button_id

if __name__ == "__main__":
    for line in sys.stdin:
        try:
            # Parse incoming JSON message
            message = json.loads(line)
            
            # Check message content for required keys
            if 'eegData' in message and 'scenario_id' in message:             
                eeg_payload = message['eegData']
                if isinstance(eeg_payload, str):
                    eeg_array = np.array(json.loads(eeg_payload), dtype=np.float32)
                else:
                    eeg_array = np.array(eeg_payload, dtype=np.float32)

                scenario_id = int(message['scenario_id'])
                                
                # Run the fbcca process
                label = run_fbcca(eeg_array, scenario_id)
                
                # Output the result as a JSON string
                print(json.dumps(label))
                sys.stdout.flush()
            else:
                raise ValueError("JSON input must contain 'eegData' and 'scenario_id' fields.")
                
        except Exception as e:
            # Handle any errors that may occur and print to stderr
            print(json.dumps({"error": str(e)}), file=sys.stderr)
            sys.stderr.flush()