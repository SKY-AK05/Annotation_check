# TaskMaster: Command-Line Task Management

**TaskMaster** is a powerful, lightweight command-line tool designed for developers and project managers who live in the terminal. It provides a fast, efficient, and scriptable way to manage your project tasks without ever leaving your development environment. Say goodbye to context switching and hello to streamlined productivity.

## 1. Why Use a CLI for Task Management?

- **Speed & Efficiency:** Create, assign, and update tasks with single commands, significantly faster than navigating a graphical user interface.
- **No Context Switching:** Stay focused in your terminal, where you do your most important work.
- **Scriptability & Automation:** Integrate task management directly into your scripts and development workflows (e.g., automatically create a task on a git commit).
- **Minimal & Distraction-Free:** A clean, text-based interface keeps you focused on the tasks at hand.

---

## 2. Features

TaskMaster offers a full suite of features to manage your projects effectively:

- **Task Creation:** Quickly create new tasks with titles, descriptions, and priorities.
- **Task Assignment:** Assign tasks to team members.
- **Status Tracking:** Update task statuses (`todo`, `in-progress`, `done`, `archived`).
- **Prioritization:** Set task priorities (`low`, `medium`, `high`, `critical`) to focus on what matters most.
- **Sub-tasks:** Break down complex tasks into smaller, manageable sub-tasks.
- **Due Dates:** Add deadlines to tasks to keep projects on schedule.
- **List & Filter:** View lists of tasks, with powerful filtering by status, assignee, or priority.
- **Detailed View:** Get a comprehensive look at a single task, including its history and all associated details.
- **Reporting:** Generate simple summary reports to track project progress.

---

## 3. Installation

TaskMaster is built with Node.js and can be easily installed via npm.

### System Requirements

- **Operating System:** macOS, Linux, or Windows (via WSL or PowerShell).
- **Node.js:** Version `18.x` or higher.
- **npm:** Version `9.x` or higher.

### Installation Steps

To install TaskMaster globally on your system, run the following command:

```bash
npm install -g taskmaster-cli
```

### Troubleshooting

- **`EACCES` Permission Errors:** If you encounter a permission error during global installation, you may need to either run the command with `sudo` (not recommended for security reasons) or [configure npm to use a different directory](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally).
- **Command Not Found:** If you run `taskmaster` and get a "command not found" error, ensure that the location where npm installs global packages is in your system's `PATH` environment variable.

---

## 4. Usage Examples

All commands follow the structure `taskmaster <command> [options]`.

### Creating a Task

Create a new task with a title, description, and priority.

**Command:**
```bash
taskmaster create "Implement user authentication" --description "Set up JWT-based authentication with password hashing." --priority high
```

**Expected Output:**
```
✔ Task #101 created successfully.
  ID: 101
  Title: Implement user authentication
  Status: todo
  Priority: high
```

### Assigning a Task

Assign task #101 to a team member.

**Command:**
```bash
taskmaster assign 101 --to "alex.dev"
```

**Expected Output:**
```
✔ Task #101 assigned to alex.dev.
```

### Updating Task Status

Update the status of task #101 to "in-progress".

**Command:**
```bash
taskmaster update 101 --status "in-progress"
```

**Expected Output:**
```
✔ Task #101 status updated to in-progress.
```

### Listing Tasks

View all tasks assigned to `alex.dev` that are currently in progress.

**Command:**
```bash
taskmaster list --assignee "alex.dev" --status "in-progress"
```

**Expected Output:**
```
┌─────┬────────────────────────────────────┬──────────────┬──────────┬──────────┐
│ ID  │ Title                              │ Assignee     │ Priority │ Status     │
├─────┼────────────────────────────────────┼──────────────┼──────────┼──────────┤
│ 101 │ Implement user authentication      │ alex.dev     │ high     │ in-progress│
└─────┴────────────────────────────────────┴──────────────┴──────────┴──────────┘
```

### Viewing a Single Task

Get all details for task #101.

**Command:**
```bash
taskmaster view 101
```

**Expected Output:**
```
─────────────── Task Details (ID: 101) ───────────────
Title:      Implement user authentication
Assignee:   alex.dev
Status:     in-progress
Priority:   high
Created:    2023-10-27 10:00:00
Updated:    2023-10-27 11:30:00

Description:
Set up JWT-based authentication with password hashing.
```

---

## 5. Data Storage Mechanism

TaskMaster prioritizes simplicity and portability. All task data is stored locally in a single JSON file named `.taskmaster/tasks.json` within your project's root directory.

- **Initialization:** When you first run a `taskmaster` command in a new project directory, it will create the `.taskmaster` folder and the `tasks.json` file automatically.
- **Portability:** You can easily back up, share, or version-control your tasks by including this file in your project's repository.
- **Security:** Since the file is stored locally, your task data remains private to your machine and anyone you share the project with.

---

## 6. Known Limitations & Future Enhancements

We are continuously working to improve TaskMaster. Here are some current limitations and our roadmap for the future.

### Limitations

- **Single Project Scope:** TaskMaster operates on a per-directory basis. It does not currently support cross-project views or a global task dashboard.
- **Local Data Only:** There is no cloud sync functionality. Data is not shared between different machines unless the `.taskmaster` directory is synced manually (e.g., via Git).

### Future Enhancements

- **Cloud Sync:** Optional integration with services like GitHub Issues or a self-hosted backend.
- **Interactive Mode:** An interactive `taskmaster ui` command to provide a more visual, terminal-based UI (e.g., using libraries like `blessed`).
- **Customizable Reports:** More advanced reporting and exporting options (e.g., CSV, Markdown).
- **Plugin System:** Allow users to extend TaskMaster with custom commands and integrations.

---

## 7. Contributing

We welcome contributions from the community!

### Reporting Issues

If you find a bug or have a feature request, please [submit an issue on our GitHub repository](https://github.com/your-org/taskmaster/issues). Please provide as much detail as possible, including steps to reproduce the issue.

### Submitting Pull Requests

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix (`git checkout -b feature/new-thing` or `fix/bug-name`).
3.  Make your changes and commit them with clear, descriptive messages.
4.  Push your branch to your fork.
5.  Submit a pull request to the `main` branch of the official repository.

Please ensure your code follows the existing style and includes tests where appropriate.

---

## 8. Licensing

TaskMaster is licensed under the **Apache License 2.0**. A copy of the license is included in the project repository.
