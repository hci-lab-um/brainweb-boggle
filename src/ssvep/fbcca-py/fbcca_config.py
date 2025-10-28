import math

class fbcca_config:
    # Class attributes (constants)
    channels = 4  # Updated to support all Emotiv EPOC X channels (was 6)
    subBands = 5
    harmonics = 5
    idleStateLabel = -1

    samplingRate = 256  # Emotiv EPOC X sampling rate
    # samplingRate = 300
    # samplingRate = 500
    # samplingRate = 512

    # correlationThreshold = 0.5
    correlationThreshold = 0.9
    # correlationThreshold = 0.85
    # correlationThreshold = 0.7

    # Timing
    gazeLengthInSecs = 4
    
    # Computed constants
    @staticmethod
    def total_data_point_count():
        return math.ceil(fbcca_config.samplingRate * fbcca_config.gazeLengthInSecs)
