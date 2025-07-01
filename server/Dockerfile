FROM node:22-alpine
WORKDIR /app
#create a /app and do all the work there
COPY . .
RUN npm install
EXPOSE 8000
#my socket is getting connected to port 8000
CMD [ "npm","run","dev" ]
#my script runs nodemon index.js in dev