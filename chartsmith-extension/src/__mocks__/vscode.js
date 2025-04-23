// Basic mock of the VS Code API for tests
const vscode = {
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    withProgress: jest.fn((options, task) => task(
      { report: jest.fn() },
      { isCancellationRequested: false, onCancellationRequested: jest.fn() }
    ))
  },
  workspace: {
    getConfiguration: jest.fn().mockImplementation(() => ({
      get: jest.fn().mockImplementation((key, defaultValue) => defaultValue)
    }))
  },
  ProgressLocation: {
    Notification: 1
  },
  Uri: {
    parse: jest.fn()
  }
};

module.exports = vscode; 