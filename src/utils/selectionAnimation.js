const { CssConstants } = require('./constants/enums');

/**
 * This function adds a border animation to the flickering buttons when they are selected (i.e. classified by the FBCCA).
 */
function addButtonSelectionAnimation(button) {
    try {
        button.classList.add('border');
        if (button.classList.contains('accent')) button.classList.add('border--accent');

        setTimeout(() => {
            try {
                button.classList.remove('border');
                if (button.classList.contains('accent')) button.classList.remove('border--accent');
            } catch (error) {
                console.error("Error removing 'pulse' class:", error.message);
            }
        }, CssConstants.SELECTION_ANIMATION_DURATION);
    } catch (error) {
        console.error("Error adding 'pulse' class to sidebar menu:", error.message);
    }
}

module.exports = {
    addButtonSelectionAnimation
};