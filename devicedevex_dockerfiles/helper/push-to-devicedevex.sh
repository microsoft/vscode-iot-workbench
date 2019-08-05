#!/bin/bash
set -x
check_docker=`docker -v`
if [[ $? != 0 ]]; then
  echo "No docker found. Please install docker first."
  exit 1
fi

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <docker image name>"
    exit 1
fi
docker_image=$1

# login in ACR
ACR_domain=devicedevex.azurecr.io
ACR_user=devicedevex
echo "### Login in to ACR: $ACR_domain"
echo "### USER_name: $ACR_user"
echo "### Please input the password for $ACR_user: "
read ACR_password
docker login $ACR_domain -u $ACR_user --password-stdin <<< $ACR_password

# Push docker image to ACR
echo "### Do you need to tag domain prefix to the image?[Y/N]"
read tagImage
new_docker_image=''
if [[ $tagImage == 'Y' || $tagImage == 'y' ]]; then
  echo "### public or internal or non? [p/i/n]"
  read Visibility
  if [[ $Visibility == 'p' || $Visibility == 'P' ]]; then
    new_docker_image="$ACR_domain/public/$docker_image"
  elif [[ $Visibility == 'i' || $Visibility == 'I' ]]; then
    new_docker_image="$ACR_domain/internal/$docker_image"
  else
    new_docker_image="$ACR_domain/$docker_image"
  fi
elif [[ $tagImage == 'N' || $tagImage == 'n' ]]; then
  new_docker_image=$docker_image
else 
  echo "WRONG INPUT!!"
  exit 1
fi

echo "Push docker image $new_docker_image to $ACR_domain..."
docker tag $docker_image $new_docker_image
docker push $new_docker_image
docker rmi $docker_image
docker rmi $new_docker_image
