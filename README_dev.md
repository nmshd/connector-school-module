# Developer Guide

## Prerequisites

- Docker
- [Taskfile](https://taskfile.dev/installation/)
- [xh cli](https://github.com/ducaale/xh?tab=readme-ov-file#installation)
- Node.js / npm
- [jq](https://jqlang.org/download/)  
  `sudo apt-get install jq` or `brew install jq`
- [qrencode](https://github.com/fukuchi/libqrencode)  
  `sudo apt-get install qrencode` or `brew install qrencode`
- (only on mac) [coreutils](https://formulae.brew.sh/formula/coreutils)  
  `brew install coreutils`

## Taskfile tasks

The `Taskfile.yml` in this repository defines various tasks to help with the development and management of the custom Connector module. Here are the tasks defined:

- **prepare**: Prepares the environment by installing necessary npm packages.
- **build**: Builds the custom module after preparing the environment.
- **watch**: Watches the custom module and rebuilds it on changes.
- **up**: Starts the Connector using Docker Compose.
- **restart**: Restarts the Connector.
- **logs**: Shows the logs of the Connector.
- ... -> run `task --list` to see all available tasks

These tasks can be run using the `task` command followed by the task name, for example, `task build` to build the custom module.

## Development

To get started with development, follow these steps:

1.  Clone the repository:

    ```bash
    git clone git@github.com:js-soft/connector-ui-module.git
    ```

2.  Change into the repository directory:

    ```bash
    cd connector-ui-module
    ```

3.  Prepare the environment:

    ```bash
    npm install
    ```

    Copy the `.env.example` to `.env` and fill out the values

4.  Start the Connector:

    ```bash
    task up
    ```

5.  Watch the custom module for changes:

    ```bash
    task watch
    ```

    this might already run when the vscode task extension is installed (check you console)

6.  Start the ui

    ```bash
    cd ui
    npm run start
    ```

    The ui is now running on "http://localhost:8080"

7.  (Optional) Add students to you connector

    To create one new student you can use:

    ```
    STUDENT_ID=<id> task create-student
    ```

    To create a batch of students with id 101-105

    ```
    task create-students
    ```
