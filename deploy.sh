#!/bin/bash

backend_directory="BackEnd"
backend_cdk_directory="BackEndCDK"

echo "Starting deploy script..."

echo "cd to backend package"

cd ..

# Check if the directory exists
if [ ! -d "$backend_directory" ]; then
  echo "Error: Directory $backend_directory not found."
  exit 1
fi

# Change to the target directory
cd "$backend_directory" || exit 1

# Check if Maven is installed
if ! command -v mvn &> /dev/null; then
  echo "Error: Maven is not installed. Please install Maven and try again."
  exit 1
fi

# Build the Java package using Maven
echo "Build the Java Backend package using Maven"

mvn package

# Check if Maven build was successful
if [ $? -eq 0 ]; then
  echo "Java package build completed successfully."
else
  echo "Java package build failed."
fi

# cd to the CDK package
echo "cd to the CDK package"

cd ..
cd "$backend_cdk_directory" || exit 1

# Check if npm is installed
if ! command -v npm &> /dev/null; then
  echo "Error: npm is not installed. Please install npm and try again."
  exit 1
fi

# Build the CDK package
echo "Build the CDK package"

npm run build

# Check if cdk is installed
if ! command -v cdk &> /dev/null; then
  echo "Error: cdk is not installed. Please install cdk and try again."
  exit 1
fi

# cdk synth
echo "synth the CDK package"
cdk synth

# cdk deploy
echo "deploy the CDK package"
cdk deploy