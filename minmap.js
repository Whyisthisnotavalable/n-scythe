javascript:(function() {
	var style = document.createElement('style');
	style.setAttribute("id", "style");
	document.head.appendChild(style);
	var css = `
	#mapDiv {
		position: absolute;
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: stretch;
		top: 0;
		left: 0;
		padding: 10vw;
		z-index: 999;
	}
	
	#minMap {
		background-color: white;
		width: 15vw;
		height: 15vh;
	}
	`;
	style.appendChild(document.createTextNode(css));
	let mapDiv = document.createElement("div");
	let minMap = document.createElement("canvas");
	mapDiv.id = "mapDiv";
	minMap.id = "minMap";
	document.body.appendChild(mapDiv);
	mapDiv.appendChild(minMap);
	
	let c = minMap.getContext("2d");
	
	function mapLoop() {
		c.clearRect(0, 0, minMap.width, minMap.height);
		
		c.beginPath();
		for (let i = 0, len = map.length; i < len; ++i) {
			let vertices = map[i].vertices;
			c.moveTo(vertices[0].x, vertices[0].y);
			for (let j = 1; j < vertices.length; j += 1) {
				c.lineTo(vertices[j].x, vertices[j].y);
			}
			c.lineTo(vertices[0].x, vertices[0].y);
		}
		c.fillStyle = "#444";
		c.fill();
		requestAnimationFrame(mapLoop)
	}
	
	mapLoop();	
})();
