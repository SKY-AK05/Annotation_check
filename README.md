
# PyEnv-Manager: The Ultimate CLI for Data Science Environments

PyEnv-Manager is a powerful, intuitive command-line tool designed to streamline the creation, management, and replication of Python virtual environments for data science and machine learning projects. It eliminates the boilerplate and potential for error associated with manual environment setup, allowing you to focus on what matters most: your code and your models.

## 1. Why PyEnv-Manager?

Managing dependencies and virtual environments is a critical but often tedious part of any data science workflow. Inconsistencies between local, staging, and production environments can lead to "it works on my machine" syndromes, costing hours of debugging.

PyEnv-Manager addresses these challenges by providing a simple, robust, and automated interface for environment management, directly from your terminal.

-   **Speed & Efficiency**: Create, activate, and manage environments with single-line commands.
-   **Reproducibility**: Ensure your environment can be perfectly replicated by colleagues or in production with a single command.
-   **No Context Switching**: Stay focused in your terminal, the primary workspace for most developers and data scientists.
-   **Best Practices by Default**: The tool is built on Python's native `venv` module, encouraging industry-standard practices without the overhead.

---

## 2. Features

-   **Automated Environment Creation**: Initialize a new, isolated Python environment within your project directory with one command.
-   **Simplified Package Management**: Install, uninstall, and manage packages using `pip` through a clean interface, with automatic updates to your requirements file.
-   **Automatic Dependency Tracking**: All package installations and removals are automatically recorded in a `requirements.txt` file, ensuring your dependencies are always up to date.
-   **One-Command Activation**: Activate the virtual environment without needing to remember complex file paths (`source .venv/bin/activate`).
-   **Seamless Replication**: Re-create an exact environment from a `requirements.txt` file, perfect for onboarding new team members or deploying to a new server.
-   **Environment Exporting**: Easily export your current environment's state to a `requirements.txt` or `requirements.lock` file for version control.
-   **Clear & Informative Status**: Quickly check the status of your environment, including the Python version and a list of installed packages.

---

## 3. Installation

PyEnv-Manager is distributed as a Python package and can be installed using `pip`.

### 3.1. System Requirements

-   **Operating System**: macOS, Linux, or Windows.
-   **Python**: Version **3.8 or higher** is required.
-   **Pip**: Version **20.0 or higher** is required.

It is highly recommended to install PyEnv-Manager at the user or system level so it can be accessed from anywhere in your terminal.

### 3.2. Installation Steps

You can install the tool using `pip`. The following command will install it for the current user:

```bash
# Install the package from PyPI
pip install pyenv-manager

# Verify the installation
pyenv --version
```

**Expected Output:**
```
pyenv-manager 1.0.0
```

### 3.3. Troubleshooting

-   **`command not found: pyenv`**: This error occurs when the directory containing the installed script is not in your system's `PATH`.
    -   **Solution (Linux/macOS)**: Find your Python user scripts directory by running `python3 -m site --user-base`. The scripts are usually in the `bin` subdirectory (e.g., `~/.local/bin`). Add `export PATH="$HOME/.local/bin:$PATH"` to your `~/.bashrc`, `~/.zshrc`, or `~/.profile` file, then restart your terminal.
    -   **Solution (Windows)**: Find the scripts directory by running `py -m site --user-site`. It's usually in a path like `C:\Users\YourUser\AppData\Roaming\Python\Python3X\Scripts`. Add this directory to your system's `PATH` environment variable.

-   **Permissions Errors during Installation**: If you are installing system-wide, you might encounter permission errors. It is generally safer to install for the current user. If you must install globally, you may need to use `sudo pip install pyenv-manager` on Linux/macOS, but this is not recommended.

---

## 4. Usage Examples

All commands follow the structure `pyenv <command> [options]`.

### 4.1. Creating a New Environment

This is typically the first command you'll run in a new project directory. It creates a `.venv` folder containing an isolated Python environment.

**Command:**
```bash
# Initialize a new virtual environment in the current directory
pyenv init
```

**Expected Output:**
```
✔ Virtual environment created successfully at ./.venv
✔ Activated environment.
To manually activate in the future, run: pyenv activate
```

### 4.2. Installing Packages

Install packages into the active environment. The tool automatically updates `requirements.txt`.

**Command:**
```bash
# Install pandas and scikit-learn
pyenv install pandas scikit-learn
```

**Expected Output:**
```
✔ Installing packages: pandas, scikit-learn...
... (pip install output) ...
✔ Successfully installed pandas-x.y.z scikit-learn-a.b.c
✔ requirements.txt has been updated.
```

### 4.3. Activating and Deactivating the Environment

**Activating:**
```bash
# Activate the environment in the current shell session
pyenv activate
```
**Expected Output:**
Your terminal prompt will change to indicate the active environment, for example:
`(.venv) $`

**Deactivating:**
```bash
# Deactivate the environment
deactivate
```

### 4.4. Checking Environment Status

View a summary of the current environment.

**Command:**
```bash
pyenv status
```
**Expected Output:**
```
┌────────────────────────┬───────────────────────────────────────────┐
│ Property               │ Value                                     │
├────────────────────────┼───────────────────────────────────────────┤
│ Environment Active     │ True                                      │
│ Path                   │ /path/to/your/project/.venv               │
│ Python Version         │ 3.10.4                                    │
│ Packages Installed     │ 25                                        │
└────────────────────────┴───────────────────────────────────────────┘
```

### 4.5. Listing Installed Packages

**Command:**
```bash
pyenv list
```
**Expected Output:**
```
┌──────────────────┬─────────┐
│ Package          │ Version │
├──────────────────┼─────────┤
│ numpy            │ 1.26.2  │
│ pandas           │ 2.1.4   │
│ scikit-learn     │ 1.3.2   │
│ ...              │ ...     │
└──────────────────┴─────────┘
```

### 4.6. Reproducing an Environment from a File

This is perfect for setting up a project on a new machine.

**Command:**
```bash
# Create and populate an environment from requirements.txt
pyenv install --from-file requirements.txt
```
**Expected Output:**
```
✔ Found requirements.txt. Installing dependencies...
... (pip install output) ...
✔ Environment is ready and all dependencies are installed.
```

---

## 5. Contributing

We welcome contributions from the community! Whether it's a bug report, a new feature suggestion, or a code contribution, we appreciate your help in making PyEnv-Manager better.

### 5.1. Reporting Issues

If you find a bug or have a feature request, please [submit an issue on our GitHub repository](https://github.com/your-org/pyenv-manager/issues). Please provide as much detail as possible, including:
-   Your operating system and Python version.
-   Steps to reproduce the issue.
-   The expected behavior and the actual behavior.

### 5.2. Submitting Pull Requests

1.  Fork the repository on GitHub.
2.  Create a new branch for your feature or bug fix (`git checkout -b feature/my-new-feature`).
3.  Make your changes and commit them with clear, descriptive messages.
4.  Push your branch to your fork (`git push origin feature/my-new-feature`).
5.  Submit a pull request to the `main` branch of the official repository.

Please ensure your code follows the existing style, includes tests where appropriate, and passes all existing tests.

### 5.3. Code of Conduct

We are committed to providing a welcoming and inclusive environment. All contributors are expected to adhere to our **Code of Conduct**. Please read it before participating.

---

## 6. Known Limitations & Future Enhancements

-   **Single Environment per Directory**: The tool is designed to manage one `.venv` environment in the root of the project directory. It does not currently support managing multiple named environments within the same project.
-   **No Python Version Management**: PyEnv-Manager manages packages within an environment, but it does not install different versions of Python itself. For that, we recommend using a tool like `pyenv` (the original) or `asdf`.

**Future Roadmap:**
-   Integration with `conda` environments.
-   An interactive mode for selecting packages to install or uninstall.
-   Plugins for project scaffolding (e.g., creating a standard data science project structure).

---

## 7. License

PyEnv-Manager is licensed under the **MIT License**. A copy of the license is included in the project repository. You are free to use, modify, and distribute this software, provided you include the original copyright and license notice.
