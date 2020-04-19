const ScratchScript = require('../src/index');

const testFile = ['t1.sb3', 't2.sb3', 't3.sb3'];

async function test(id, name) {
    let script = new ScratchScript();
    console.log(`${id}> extracting...`);
    await script.extractProject(name, `${name}.extract`);
    console.log(`${id}> extracted`);
    console.log(`${id}> converting...`);
    await script.convertScript(`${name}.extract/project.json`, `${name}.extract/script`);
    console.log(`${id}> converted`);
}

for (let i in testFile) {
    new Promise((resolve, reject) => {
        test(i, testFile[i]);
        resolve();
    });
}
