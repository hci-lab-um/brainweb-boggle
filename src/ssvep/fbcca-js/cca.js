const { Matrix, SVD } = require('ml-matrix');
const math = require('mathjs');

// Helper functions
function centreMatrix(matrix) {
    const mean = math.mean(matrix, 0); // Compute the mean of each column
    const centeredMatrix = math.subtract(matrix, mean); // Subtract the mean from each element
    return centeredMatrix;
}

function calculateRank(S, n, p) {
    const eps = Number.EPSILON;
    return S.filter(value => value > eps * Math.max(n, p)).length;
}

function canoncorr(X, Y) {
    X = math.matrix(X);
    Y = math.matrix(Y);
    X = math.transpose(X);
    Y = math.transpose(Y);

    // Error checking
    if (arguments.length < 2) {
        throw new Error('TooFewInputs');
    }

    let n = X._size[0]  // rows of X
    let p1 = X._size[1] // columns of X
    let p2 = Y._size[1]; // columns of Y

    if (Y._size[0] !== n) { // Y._size[0] = rows of Y
        throw new Error('InputSizeMismatch');
    } else if (n === 1) {
        throw new Error('NotEnoughData');
    }

    // Centre the variables
    X = centreMatrix(X);
    Y = centreMatrix(Y);

    // QR Decomposition for X
    let svdX = new SVD(new Matrix(X.toArray()), { autoTranspose: true });
    let Q1 = svdX.leftSingularVectors;
    let S1 = svdX.diagonal;

    let rankX = calculateRank(S1, n, p1);

    if (rankX === 0) {
        throw new Error('BadData X');
    } else if (rankX < p1) {
        Q1 = Q1.subMatrix(0, Q1.rows - 1, 0, rankX - 1);
    }

    // QR Decomposition for Y
    let svdY = new SVD(Y.toArray(), { autoTranspose: true });
    let Q2 = svdY.leftSingularVectors;
    let S2 = svdY.diagonal;

    let rankY = calculateRank(S2, n, p2);

    if (rankY === 0) {
        throw new Error('BadData Y');
    } else if (rankY < p2) {
        Q2 = Q2.subMatrix(0, Q2.rows - 1, 0, rankY - 1);
    }

    // Compute canonical correlations
    let Q1TQ2 = Q1.transpose().mmul(Q2);
    let svdResult = new SVD(Q1TQ2, { autoTranspose: true });
    let D = svdResult.diagonal;

    let d = Math.min(rankX, rankY);
    let r = D.slice(0, d).map(value => Math.min(Math.max(value, 0), 1)); // Remove roundoff errors

    return r;
}

module.exports = { canoncorr }