#!/usr/bin/env node

const Minio = require('minio');
const fs = require('fs');

const minioClient = new Minio.Client({
    endPoint: process.env.NMC_HOST,
    port: +process.env.NMC_PORT,
    secure: !!+process.env.NMC_SECURE,
    accessKey: process.env.NMC_ACCESS_KEY,
    secretKey: process.env.NMC_SECRET_KEY
});

// console.log(process.env);

const pkg = require('./package.json');

const cmds = {
    version: getVersion,
    help: showHelp,
    buckets: () => {
        minioClient.listBuckets(function (err, buckets) {
            if (err) return console.log(err);
            console.log('buckets :', buckets);
            process.exit();
        });
    },
    list: (bucket) => {
        let stream = minioClient.listObjectsV2(bucket, '', true);
        stream.on('data', function (obj) { console.log(obj); });
        stream.on('error', errorHandler);

    },
    get: (bucketName, objectName) => {

        minioClient.getObject(bucketName, objectName, function (err, dataStream) {
            if (err) {
                return console.log(err);
            }

            let wstream = fs.createWriteStream(objectName);

            dataStream.on('data', function (chunk) {
                wstream.write(chunk);
            });
            dataStream.on('end', function () {
                wstream.end(() => {
                    console.log('Done!');
                });
            });
            dataStream.on('error', errorHandler);
        });
    },
    up: (bucketName, objectName) => {
        let file = objectName;
        let fileStream = fs.createReadStream(file);
        fs.stat(file, function (err, stats) {
            if (err) {
                return errorHandler(err);
            }
            minioClient.putObject(bucketName, objectName, fileStream, stats.size, function (err, etag) {
                return console.log(err, etag); // err should be null
            });
        });
    }
};


let cmd = process.argv[2];
let args = process.argv.slice(3);


let exit = process.exit;

if (!cmd) {
    getVersion();
    showHelp();
}

try {
    cmds[cmd](...args);
} catch (err) {
    errorHandler(err);
}

function errorHandler(err) {
    console.error('Error:', `Running "${cmd}" failed!`, '\n');
    console.error(err);
    process.exit(1);
}

function getVersion() {
    console.log(`Minio Cli for NodeJs, Version: ${pkg.version}
    `);
}

function showHelp() {
    console.log(`Usage:
    nmc <command> [arguments]
    nmc version
    nmc buckets
    nmc lists myBucket

Commands:
    buckets
    lists <bucketName>
    get <bucketName> <objectName>
    up <bucketName> <path/fileName>
    `);

    exit();
}

