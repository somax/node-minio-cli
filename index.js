#!/usr/bin/env node

const Minio = require('minio');
const fs = require('fs');
const inquirer = require('inquirer');


const cmd = process.argv[2];
const args = process.argv.slice(3);
const exit = process.exit;

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
    new: (bucketName, region) => {
        region = region || 'us-east-1';
        minioClient.makeBucket(bucketName, region, function (err) {
            if (err) return errorHandler(err);
            console.log(`Bucket created successfully in ${region}.`);
            exit();
        });
    },
    ls: (bucketName) => {
        if (!bucketName) {
            minioClient.listBuckets(function (err, buckets) {
                if (err) return console.log(err);
                console.log('Buckets:\n', buckets);
                process.exit();
            });
        } else {
            let stream = minioClient.listObjectsV2(bucketName, '', true);
            stream.on('data', function (obj) { console.log(obj); });
            stream.on('error', errorHandler);
        }

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
                if (err) {
                    return errorHandler(err);
                } else {
                    console.log(`Upload ${objectName} to ${bucketName} successfully.\nEtag: ${etag}`);
                    exit();
                }
            });
        });
    },
    rm: (bucketName, objectName) => {
        if(!bucketName){
            errorHandler('Remove what?');
        }
        let questions = [{ type: 'confirm', name: 'delete', default: false, message: 'Do you know what you are doing now?' }];
        inquirer.prompt(questions).then(function (answers) {
            if (answers.delete) {
                if (!objectName) {
                    // remove bucket
                    minioClient.removeBucket(bucketName, function (err) {
                        if (err) return errorHandler(err);
                        console.log('Bucket removed successfully.');
                        exit();
                    });
                } else {
                    // remove object
                    minioClient.removeObject(bucketName, objectName, function (err) {
                        if (err) {
                            return errorHandler(err);
                        }
                        console.log('The object removed successfully.');
                        exit();
                    });
                }
            }
        });
    }
};




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
    console.error(typeof err === 'string' ? err : err.message);
    exit(1);
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
    new <bucketName>                  - Add new bucket
    ls                                - List buckets
    ls  <bucketName>                  - List objects in the bucket
    rm  <bucketName>                  - Remove the bucket
    rm  <bucketName> <objectName>     - Delete object from the bucket
    get <bucketName> <objectName>     - Download object from th bucket
    up  <bucketName> <path/fileName>  - Upload object to the bucket
    `);

    exit();
}

