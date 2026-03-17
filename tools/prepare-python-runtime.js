const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const runtimeRoot = path.join(projectRoot, 'build', 'python-runtime');
const venvRoot = path.join(runtimeRoot, 'venv');
const requirementsFile = path.join(projectRoot, 'requirements.txt');

function getVenvPythonPath() {
    if (process.platform === 'win32') {
        return path.join(venvRoot, 'Scripts', 'python.exe');
    }

    const python3Path = path.join(venvRoot, 'bin', 'python3');
    if (fs.existsSync(python3Path)) {
        return python3Path;
    }

    return path.join(venvRoot, 'bin', 'python');
}

function runCommand(command, args, description) {
    console.log(`[python-runtime] ${description}`);

    const result = spawnSync(command, args, {
        cwd: projectRoot,
        stdio: 'inherit',
        shell: false,
        env: process.env,
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error(`Command failed: ${command} ${args.join(' ')}`);
    }
}

function main() {
    const pythonCommand = process.env.BOGGLE_PYTHON || 'python';

    runCommand(pythonCommand, ['--version'], 'Checking Python availability');

    fs.rmSync(runtimeRoot, { recursive: true, force: true });
    fs.mkdirSync(runtimeRoot, { recursive: true });

    runCommand(pythonCommand, ['-m', 'venv', venvRoot], 'Creating bundled Python virtual environment');

    const venvPython = getVenvPythonPath();
    if (!fs.existsSync(venvPython)) {
        throw new Error(`Bundled python executable was not created at ${venvPython}`);
    }

    runCommand(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip'], 'Upgrading pip in bundled environment');
    runCommand(venvPython, ['-m', 'pip', 'install', '-r', requirementsFile], 'Installing runtime Python dependencies');

    console.log(`[python-runtime] Ready at ${runtimeRoot}`);
}

main();
