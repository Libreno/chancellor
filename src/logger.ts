// Copyright © 2020 Farkhad Muminov. All rights reserved.
const consolewrite = (write: any) => {
    return (message: any) => {
        var today = new Date()
        var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds() + ":" + today.getMilliseconds()
        if (typeof message === 'object'){
            write(`${time} => object:`)
            write(message)
        } else {
            write(`${time} => ${message}`)
        }
    }
}

const log = consolewrite(console.log)

const warn = consolewrite(console.warn)

export default log
export { warn }