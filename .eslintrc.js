module.exports = {
  "env": {
    "node": true,
    "mocha": true,
  },
  "plugins": [
    "node",
    "prettier",
  ],
  "extends": [
    "eslint:recommended",
    "airbnb",
    "plugin:node/recommended",
    "prettier",
  ],
  "rules": {
    "global-require": "off",
    "no-console": "off",
    "node/no-unpublished-require": ["error", {"allowModules": ["chai", "sinon", "sinon-test"]}],
    "prettier/prettier": ["error", {"singleQuote": true, "printWidth": 160}],
    "prefer-const": "error",
    "prefer-rest-params": "off",
    "valid-jsdoc": "off",
    "camelcase": 2,
  }
};
