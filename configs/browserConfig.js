const browserConfig = {
    stimuli: {
        maxConcurrentStimuli: 18,
        customSetup: {
            enabled: true,
            patterns: {
                line: 'line',
                dot: 'dot',
                solid: 'solid',
                chequered: 'chequered'
            },
            colors: {
                lightColor: '255,255,255,1', // White
                darkColor: '127,127,127,1',  // Grey
            },
            // INSERT COLOUR CONSANTS HERE <---------------

            // frequencyPhasePairs: [
            //     {
            //         phase: '0',
            //         frequency: '7'
            //     },
            //     {
            //         phase: '0.5',
            //         frequency: '6.5'
            //     },
            //     {
            //         phase: '1',
            //         frequency: '8.5'
            //     },
            //     {
            //         phase: '1.5',
            //         frequency: '10.5'
            //     },
            //     {
            //         phase: '0',
            //         frequency: '12.5'
            //     },
            //     {
            //         phase: '0.5',
            //         frequency: '14.5'
            //     },
            //     {
            //         phase: '1',
            //         frequency: '6'
            //     },
            //     {
            //         phase: '1.5',
            //         frequency: '8'
            //     },
            //     {
            //         phase: '0',
            //         frequency: '14'
            //     },
            //     {
            //         phase: '0.5',
            //         frequency: '12'
            //     },
            //     {
            //         phase: '1',
            //         frequency: '10'
            //     },
            //     {
            //         phase: '1.5',
            //         frequency: '7.5'
            //     },
            //     {
            //         phase: '0',
            //         frequency: '9.5'
            //     },
            //     {
            //         phase: '0.5',
            //         frequency: '11.5'
            //     },
            //     {
            //         phase: '1',
            //         frequency: '13.5'
            //     },
            //     {
            //         phase: '1.5',
            //         frequency: '13'
            //     },
            //     {
            //         phase: '0',
            //         frequency: '11'
            //     },
            //     {
            //         phase: '0.5',
            //         frequency: '9'
            //     }
            // ]
        }
    }
}

module.exports = { browserConfig };