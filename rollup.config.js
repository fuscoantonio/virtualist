import { terser } from 'rollup-plugin-terser';

export default {
    input: 'src/virtualist.js',
    output: [
        {
            file: 'dist/virtualist.esm.js',
            format: 'esm',
            sourcemap: true,
            plugins: [terser()]
        },
        {
            file: 'dist/virtualist.cjs.js',
            format: 'cjs',
            sourcemap: true,
            exports: 'default',
            plugins: [terser()]
        }
    ]
};