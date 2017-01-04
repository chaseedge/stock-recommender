# stock-recommender
This was my first crack at programming. In this project I could only use pure javascript (no jquery). 

It take a US stock ticker as a parameter and does a simple valuation to determine if the stock is possibly under or overvalued.

Since this was my first crack, my biggest challenges dealt with asynchornous requests since one HTTP request was reliant on another. I used Promises to help deal with this.

## Getting Started
There are no special requirements to run this webapp. Simply download the folder and open the index.html file

### Running 
Simply enter in a valid US stock ticker

### APIs used
The large part of the data is sourced from Yahoo finance. 
It uses CapitalCube to get peers and multiples for a given ticker.

