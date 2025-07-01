FROM node:22-alpine
WORKDIR /app
#create a /app and do all the work there
COPY . .
RUN npm install
EXPOSE 5173
#my Vite-REACT is getting connected to port 5173
CMD [ "npm","run","dev" ]
#React-VITE runs on this