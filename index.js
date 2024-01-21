import fs from 'fs';
import axios from 'axios';
import { createCanvas } from 'canvas';
import { Chart } from 'chart.js/auto';
import dotenv from 'dotenv';
dotenv.config();

const apiUrl = 'https://api.whales.market/transactions/offers';
const queryParams = {
    take: 50,
    page: 1,
    type: 'sell',
    category: '',
    token_status: 'active',
    address: '',
    full_match: '',
    address_ex: '',
    search: '',
    status: 'open',
    sort_time: '',
    sort_price: 'asc',
    filled: false
};

const botToken = process.env.BOT_TOKEN;
const chatId = process.env.CHAT_ID;
console.log(botToken, chatId)

// Function to read the previous response from a file
function readPreviousResponse() {
    try {
        const data = fs.readFileSync('previous_response.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Return an empty object if the file doesn't exist or is invalid
        return {};
    }
}

// Function to write the current response to a file
function writeCurrentResponse(responseData) {
    fs.writeFileSync('previous_response.json', JSON.stringify(responseData, null, 2));
}

// Function to send a message to the Telegram bot
function sendTelegramMessage(newListings) {
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const message = newListings.map(item => {
        if (parseFloat(item.price) > 0.69) {
            return `
New Listing:
- Token: ${item.token.symbol} (${item.token.name})
- Price: ${item.price}
- Quantity: ${item.total_amount}
- https://app.whales.market/offer/${item.id}
            `;
        } else {
            return `
📌💥📢📌💥📢📌💥📢📌💥📢
New Listing low price:
- Token: ${item.token.symbol} (${item.token.name})
- Price: ${item.price}
- Quantity: ${item.total_amount}
- https://app.whales.market/offer/${item.id}
📌💥📢📌💥📢📌💥📢📌💥📢
            `;
        }
    }).join('\n');

    const telegramParams = {
        chat_id: chatId,
        text: message
    };


    axios.post(telegramApiUrl, telegramParams)
        .then(response => {
            console.log('Telegram message sent:', response.data);
        })
        .catch(error => {
            console.error('Error sending Telegram message:', error);
        });
}

// Function to create a scatter plot
async function createScatterPlot(data) {
    const canvas = createCanvas(800, 600);
    const ctx = canvas.getContext('2d');

    const prices = data.map(item => item.price > 0.1 ? item.price : null);
    const quantities = data.map(item => item.total_amount > 5 ? item.total_amount : null);

    const scatterPlot = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Token Listings',
                data: prices.map((price, index) => ({ x: price, y: quantities[index] })),
                backgroundColor: 'rgb(75, 192, 192)',
            }]
        },
        options: {
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                },
                y: {
                    type: 'logarithmic',
                    position: 'left',
                }
            },
        },
    });

    const buffer = canvas.toBuffer('image/jpeg');
    fs.writeFileSync('scatter_plot.jpg', buffer);
    console.log('Scatter plot saved as scatter_plot.jpg');
}

axios.get(apiUrl, { params: queryParams })
    .then(response => {
        const currentResponse = response.data.data.list; // Assuming 'data' is the property containing the array
        const previousResponse = readPreviousResponse();
        //console.log(currentResponse)

        // Compare the current and previous responses
        const newListings = currentResponse.filter(currentItem => {
            return !previousResponse.some(prevItem => prevItem.id === currentItem.id);
        });

        if (newListings.length > 0) {
            console.log('New listings detected!');

            // Create a scatter plot with the new data
            createScatterPlot(currentResponse);

            // Save the current response for future comparison
            writeCurrentResponse(currentResponse);

            // Send the new listings data to Telegram
            sendTelegramMessage(newListings);
        } else {
            console.log('No new listings.');
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });