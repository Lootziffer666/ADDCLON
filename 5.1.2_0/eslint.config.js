const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    // Global ignores
    {
        ignores: ['node_modules/**', 'lib/**', 'eslint.config.js']
    },
    
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                ...globals.browser,
                ...globals.webextensions,
                // Add any custom globals your project uses
            }
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': 'off'
        }
    },
    {
        // Background script and shared modules use ES6 modules
        files: ['background.js', 'bg-components/**/*.js', 'shared/**/*.js'],
        languageOptions: {
            sourceType: 'module'
        }
    }
];