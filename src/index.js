'use strict';

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

class ScriptFile {
    constructor() {
        this.fileData = '';
        this.indent = 0;
    }

    write(data, indent) {
        if (indent) this.fileData += ' '.repeat(this.indent * 4);
        this.fileData += data;
    }

    writeln(data, indent) {
        if (indent) this.fileData += ' '.repeat(this.indent * 4);
        this.fileData += data;
        this.fileData += '\n';
    }

    addIndent(n) {
        this.indent += n;
    }

    getData() {
        return this.fileData;
    }
}

class ScratchScript {
    extractProject(filePath, targetPath) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath);
            const data = fs.readFileSync(filePath);
            let zip = new JSZip();
            zip.loadAsync(data).then(content => {
                let count = 0;
                for (let fileName in content.files) {
                    ++count;
                    zip.file(fileName).async('nodebuffer').then(data => {
                        fs.writeFileSync(path.join(targetPath, fileName), data);
                        --count;
                        if (count === 0) resolve();
                    });
                }
            });
        });
    }

    convertScript(filePath, targetPath) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath);
            fs.readFile(filePath, (err, data) => {
                if (err) reject(err);
                const project = JSON.parse(data);
                const targets = project.targets;
                for (let i in targets) {
                    const target = targets[i];

                    // Write meta data
                    let script = new ScriptFile();
                    script.writeln('// Generate by scratch-script', true);
                    script.writeln(`#meta(${target.isStage}, ${JSON.stringify(target.name)});`, true);
                    
                    // Init variables and lists
                    for (let i in target.variables) {
                        const variable = target.variables[i];
                        script.writeln(`#init_var("${variable[0]}", ${JSON.stringify(variable[1])});`, true);
                    }
                    for (let i in target.lists) {
                        const list = target.lists[i];
                        script.writeln(`#init_list("${list[0]}", ${JSON.stringify(list[1])});`, true);
                    }

                    // Generate blocks
                    for (let i in target.blocks) {
                        const block = target.blocks[i];
                        if (typeof block !== 'object' || block.topLevel !== true) continue;
                        script.writeln(`@(${block.x}, ${block.y})`, true);
                        if (block.opcode === 'procedures_definition') {
                            const param = JSON.stringify(target.blocks[block.inputs.custom_block[1]].mutation.proccode);
                            script.writeln(`${block.opcode}(${param}, {`, true);
                        }
                        else {
                            const param = this.convertParam(project, target, block);
                            if (param.length > 0) script.writeln(`${block.opcode}(${param}, {`, true);
                            else script.writeln(`${block.opcode}({`, true);
                        }
                        script.addIndent(1);
                        let nextBlock = block.next;
                        while (nextBlock !== null) {
                            nextBlock = target.blocks[nextBlock];
                            const line = `${this.convertBlock(project, target, nextBlock)};`.split('\n');
                            for (let n in line) {
                                script.writeln(line[n], true);
                            }
                            nextBlock = nextBlock.next;
                        }
                        script.addIndent(-1);
                        script.writeln(`});`, true);
                    }

                    fs.writeFileSync(path.join(targetPath, `${target.name}.scs`), script.getData());
                }
            });
            resolve();
        });
    }

    convertBlock(project, target, block) {
        if (block.opcode === 'procedures_call') {
            return `${block.opcode}(${[JSON.stringify(block.mutation.proccode), this.convertParam(project, target, block)].join(', ')})`;
        }
        return `${block.opcode}(${this.convertParam(project, target, block)})`;
    }

    convertParam(project, target, block) {
        let ret = [];
        for (let n in block.fields) {
            ret.push(JSON.stringify(block.fields[n][0]));
        }
        for (let n in block.inputs) {
            const input = block.inputs[n];
            if (input[1] === null) {
                ret.push('{}');
            }
            else if (typeof input[1] === 'string') {
                if (target.blocks[input[1]].next === null) {
                    ret.push(this.convertBlock(project, target, target.blocks[input[1]]));
                }
                else {
                    let script = new ScriptFile();
                    script.writeln('{', true);
                    script.addIndent(1);
                    let nextBlock = input[1];
                    while (nextBlock !== null) {
                        nextBlock = target.blocks[nextBlock];
                        const line = `${this.convertBlock(project, target, nextBlock)};`.split('\n');
                        for (let n in line) {
                            script.writeln(line[n], true);
                        }
                        nextBlock = nextBlock.next;
                    }
                    script.addIndent(-1);
                    script.write('}', true);
                    ret.push(script.getData());
                }
            }
            else if(input[1][0] === 12) {
                let monitor = null;
                for (let n in project.monitors) {
                    if (project.monitors[n].id === input[1][2]) {
                        monitor = project.monitors[n];
                        break;
                    }
                }
                if (monitor === null) {
                    if (target.variables[input[1][2]] !== undefined) {
                        ret.push(`data_variable${input[1][1]}`);
                    }
                    else {
                        ret.push(`data_listcontents${input[1][1]}`);
                    }
                }
                else {
                    const param = JSON.stringify(monitor.type === 'list' ? monitor.params.LIST : monitor.params.VARIABLE);
                    ret.push(`${monitor.opcode}(${param})`);
                }
            }
            else {
                ret.push(JSON.stringify(input[1][1]));
            }
        }
        return ret.join(', ');
    }
}

module.exports = ScratchScript;

