
console.log('kjshkjdshkhskjhsakjhs');

const root = document.getElementById('root')
function render() {
    const title = require('./title').default
    root.innerHTML = title
}

render()

if (module.hot) {
    module.hot.accept(['./title'], render)
}