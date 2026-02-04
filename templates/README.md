Dependecies:
    - eleventy => npm install @11ty/eleventy

Code generation:
npx @11ty/eleventy --input=templates\index.md --output=docs
npx @11ty/eleventy --input=templates\test.md --output=bin\server\html\


npx tsc + tscconfig.json