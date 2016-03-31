/*Table of Contents
1. Populate Autocomplete Fields
2. Pulling in Data
3. Calculate Information
4. Output Data



*/
// global variables
//1. Populate Autocomplete Fields
// Uses "Awesomplete" and an object of all tickers
//

function autoTickers(){ //adds tickers to the autocomplete form. Code in Tickers.js file
	//addTickers();
	//startAuto();
}

function startAuto(){
	var tag = document.createElement("script");
	tag.src = "scripts/awesomplete.js";
	document.getElementsByTagName("head")[0].appendChild(tag);
}

function addTickers() {
	var tickers = allTickers();

	var list = document.getElementById('mylist');

	for (var i = 0; i < tickers.length; i++) {
		var entry = tickers[i];
		var name = entry["Name"];
		var ticker = entry["Symbol"];
		var option = document.createElement('option');
		option.text = name + " - " + ticker;
		option.value = ticker;
		list.appendChild(option);
	}
}


//2. Pulling in Data
//var link = "https://www.quandl.com/api/v3/datasets/SF0/"+ ticker +"_EBITDA_MRY.json?auth_token=NqfzA-DNoQiwhzYiqZCi";
//var link = "http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20yahoo.finance.quotes%20where%20symbol%20in%20%28%22AAPL%22%29&format=json&env=https://raw.githubusercontent.com/cynwoody/yql-tables/finance-1/tables.env";
// var statsLink = "http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20yahoo.finance.keystats%20where%20symbol%20in%20("YHOO","AAPL","GOOG","MSFT")&format=json&env=https://raw.githubusercontent.com/cynwoody/yql-tables/finance-1/tables.env";
// var quoteLink = "http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20yahoo.finance.quotes%20where%20symbol%20in%20(%22AAPL%22)&format=json&env=https://raw.githubusercontent.com/cynwoody/yql-tables/finance-1/tables.env";
// var peersLink = "http://api.capitalcube.com/companies/" + ticker + "-us/peers";



function getData() {
	var ticker = document.getElementById("ticker").value;
	var targetPrices = {};
	var compInfo = {};
	var priceTarget = {};
	var multiples = {
		priceEarnings : {},
		priceBook : {},
		evEbitda : {},
		evFcf : {}
	};


	var colsTopTable = ["labels", "rating", "empty", "peerMin", "peerMedian", "peerMax"];
	var propArr = ["LastTradePriceOnly","EarningsShare","EBITDA","EnterpriseValue",
	"BookValuePerShare","symbol","TotalDebt","TotalCash","Name","SharesOutstanding"];


	function quote(data){
		data = data.query.results.quote;
		compInfo["textEBITDA"] = data["EBITDA"];
		addProp(data, compInfo, propArr);
		console.log(compInfo);
	}

	function stats(data){
		data = data.query.results.stats;
		console.log(data);
		addProp(data, compInfo, propArr);
		console.log(compInfo);
	}

	function peers(data){
		data = data.keyValuationItems;
		parsePeers(data, multiples, compInfo);
		htmlMultiples(multiples, colsTopTable);
		htmlCompInfo(compInfo);
		console.log(multiples);
	}

	infoRequest(buildLink(ticker, "quote")).then(function(data){
		quote(data);
		return infoRequest(buildLink(ticker, "stats")).then(function(data){
			stats(data);
			return infoRequest(buildLink(ticker, "peers")).then(function(data){
				peers(data);
				calcTargetPrice(compInfo, multiples, priceTarget);
			})
		})
	}).catch(function(error) {console.log("ERROR - SOMETHING WENT TERRIBLY WRONG!");});


}

function infoRequest (url) {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onload = function () {
      if (this.readyState == 4 && this.status == 200) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject({statusText: xhr.statusText});
      }
    };
    xhr.onerror = function () {
      reject({statusText: xhr.statusText});
    };
    xhr.send();
  });
}

function parseQuote(data){}

function parsePeers(data, multiples, compInfo){
	multiples["priceEarnings"] = data["Price to Earnings (P/E)"];
	multiples["priceBook"] = data["Price to Book (P/B)"];
	multiples["evEbitda"] = data["EV / EBITDA"];
	multiples["evFcf"] = data["EV / FCF"];
	compInfo["fcf"] = Number(compInfo["EnterpriseValue"]) / Number(multiples["evFcf"]["rating"]);
	compInfo["fcf"] = compInfo["fcf"].toFixed(0);
}
function calcTargetPrice(compInfo, multiples, targetPrices) {
	var pe = multiples.priceEarnings.peerMedian;
	var eps = compInfo.EarningsShare;
	var pb = multiples.priceBook.peerMedian;
	var bv = compInfo.BookValuePerShare;
	if (!isNaN(pe * eps)) {
		targetPrices["PE"] = pe * eps;
	}
	if (!isNaN(pb * bv)) {
		targetPrices["PB"] = pb * bv;
	}
	console.log(targetPrices);
}




function buildLink(ticker, database){
	var link;
	if (database === "stats")
		link = "http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20yahoo.finance.keystats%20where%20symbol%20in%20('" + ticker + "')&format=json&env=https://raw.githubusercontent.com/cynwoody/yql-tables/finance-1/tables.env";
	if (database === "quote")
		link = "http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20yahoo.finance.quotes%20where%20symbol%20in%20('" + ticker + "')&format=json&env=https://raw.githubusercontent.com/cynwoody/yql-tables/finance-1/tables.env";
	if (database === "peers")
		link = "http://api.capitalcube.com/companies/" + ticker + "-us/reports/peer-characteristics";
	return link;
}

function addProp(data, targetObj, propArr) {
  for (var i = 0; i < propArr.length; i++){
    var property = propArr[i];
    if (data.hasOwnProperty(property)) {
        targetObj[property] = data[property];
        if(targetObj[property].hasOwnProperty("content"))
          	targetObj[property] = targetObj[property]["content"];
      }
   }
}

function htmlMultiples(obj, columns) {
	for (var x in obj) {
		for (var key in obj[x]) {
			var col = columns.indexOf(key);
			var value = Number(obj[x][key]).toFixed(2);
			if (isNaN(value)){
				value = "n/a";
			}
			var row = document.getElementById(x);
			if (row && col > 0) {
				var cells = row.getElementsByTagName("td");
				cells[col].innerHTML = value;
			}
		}
	}
}

function formatNum(num) {
  return (num + "").replace(/\b(\d+)((\.\d+)*)\b/g, function(a, b, c) {
    return (b.charAt(0) > 0 && !(c || ".").lastIndexOf(".") ? b.replace(/(\d)(?=(\d{3})+$)/g, "$1,") : b) + c;
  });
}

function htmlCompInfo(compInfo){
	var row = document.getElementById("LastTradePriceOnly");
	var cells = row.getElementsByTagName("td");
	cells[1].innerHTML = "$" + compInfo["LastTradePriceOnly"];
	row = document.getElementById("priceEarningsTarget");
	var cells = row.getElementsByTagName("td");
	cells[1].innerHTML = "$" + compInfo["EarningsShare"];
	row = document.getElementById("priceBookTarget");
	var cells = row.getElementsByTagName("td");
	cells[1].innerHTML = "$" + compInfo["BookValuePerShare"];
	row = document.getElementById("evEbitdaTarget");
	var cells = row.getElementsByTagName("td");
	cells[1].innerHTML = "$" + compInfo["textEBITDA"];
	row = document.getElementById("evFcfTarget");
	var cells = row.getElementsByTagName("td");
	cells[1].innerHTML = formatNum(compInfo["fcf"]);
}
