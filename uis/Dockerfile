FROM node:22-alpine

WORKDIR /app

# -----------------------------------------
# Install website dependencies separately
# -----------------------------------------
COPY website/package*.json ./website/
RUN cd website && npm install

# -----------------------------------------
# Install backoffice dependencies separately
# -----------------------------------------
COPY backoffice/package*.json ./backoffice/
RUN cd backoffice && npm install

# Copy all UI source code
COPY . .

# Windows may save shell files with CRLF line endings.
# Normalize the script and make it executable.
RUN sed -i 's/\r$//' /app/start.sh \
    && chmod +x /app/start.sh

EXPOSE 3000 3001

CMD ["/app/start.sh"]