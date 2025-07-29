const fbccaConfiguration = {
    // Class attributes (constants)
    channels: 14,  // Updated to support all Emotiv EPOC X channels (was 6)
    subBands: 5,
    harmonics: 5,
    idleStateLabel: -1,

    // samplingRate: 128,
    // samplingRate: 500,
    // samplingRate: 300,
    samplingRate: 256,  // Emotiv EPOC X sampling rate

    // correlationThreshold: 0.7,
    correlationThreshold: 0.85,
    // correlationThreshold: 0.9,

    // Timing
    gazeLengthInSecs: 4,

    // Computed constants
    totalDataPointCount: function () {
        return Math.ceil(this.samplingRate * this.gazeLengthInSecs);
    }
};

module.exports = { fbccaConfiguration };