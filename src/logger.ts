const log = (message: any) => {
    var today = new Date();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds() + ":" + today.getMilliseconds();
    if (typeof message === 'object'){
        console.log(`${time} => object:`);
        console.log(message);
    } else {
        console.log(`${time} => ${message}`);
    }
}

export default log;
