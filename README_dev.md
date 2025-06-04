# Developer Guide

## Prerequisites

- Docker
- [Taskfile](https://taskfile.dev/installation/)
- [httpie cli](https://httpie.io/cli)
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
    git clone https://github.com/nmshd/custom-connector-modules.git
    ```

2.  Change into the repository directory:

    ```bash
    cd custom-connector-modules
    ```

3.  Prepare the environment:

    ```bash
    task prepare
    ```

4.  Start the Connector:

    ```bash
    task up
    ```

5.  Watch the custom module for changes:

    ```bash
    task watch
    ```

6.  Make changes to the custom module and see the changes reflected in the Connector. Make sure to restart the Connector when finished:

    ```bash
    task restart
    ```
