javascript:(function() {
	var style = document.createElement('style');
	style.setAttribute("id", "style");
	document.head.appendChild(style);
	var css = `
	#mapDiv {
		position: absolute;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: stretch;
		bottom: 0;
		right: 0;
		width: 15vw;
		height: 20vh;
		background-color: gray;
		border: 5px solid gray;
		border-radius: 5px;
		z-index: 999;
		cursor: move;
	}

	#minMap {
		width: 100%;
		height: 15vh;
	}

	#mapControls {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 5px;
		background-color: gray;
	}
	
	.hidden {
		display: none;
		width: 0;
		height: 0;
	}
	`;
	style.appendChild(document.createTextNode(css));

	let mapDiv = document.createElement("div");
	let minMap = document.createElement("canvas");
	let mapControls = document.createElement("div");

	mapDiv.id = "mapDiv";
	minMap.id = "minMap";
	mapControls.id = "mapControls";

	document.body.appendChild(mapDiv);
	mapDiv.appendChild(minMap);
	mapDiv.appendChild(mapControls);

	mapControls.innerHTML = `<button id="toggleDivButton">❌</button> <div style="background-color: white; padding: 2.5px; border-radius: 2px;">hide/show</div>`;
	let c = minMap.getContext("2d");
	function toggleVis() {
		minMap.classList.toggle("hidden");
		
		if (minMap.classList.contains("hidden")) {
			mapDiv.style.height = "4vh";
		} else {
			mapDiv.style.height = "20vh";
		}
	}
	document.getElementById("toggleDivButton").addEventListener("click", toggleVis);
	function mapLoop() {
		minMap.style.backgroundColor = document.body.style.backgroundColor;
		c.clearRect(0, 0, minMap.width, minMap.height);
		
		c.save();
		c.scale(0.05, 0.05);
		c.translate(-m.pos.x + minMap.width * 10, -m.pos.y + minMap.height * 10);
		
		c.lineWidth = 2;
        let i = mob.length;
        while (i--) {
            c.beginPath();
            const vertices = mob[i].vertices;
            c.moveTo(vertices[0].x, vertices[0].y);
            for (let j = 1, len = vertices.length; j < len; ++j) c.lineTo(vertices[j].x, vertices[j].y);
            c.lineTo(vertices[0].x, vertices[0].y);
            c.fillStyle = mob[i].fill !== ("transparent" || "#00000000") ? mob[i].fill : "black";
            c.strokeStyle = mob[i].stroke;
            c.fill();
            c.stroke();
        }
		
		c.beginPath();
		for (let i = 0, len = body.length; i < len; ++i) {
			let vertices = body[i].vertices;
			c.moveTo(vertices[0].x, vertices[0].y);
			for (let j = 1; j < vertices.length; j++) {
				c.lineTo(vertices[j].x, vertices[j].y);
			}
			c.lineTo(vertices[0].x, vertices[0].y);
		}
		c.lineWidth = 2;
		c.fillStyle = "rgba(140,140,140,0.85)";
		c.fill();
		c.strokeStyle = "#222";
		c.stroke();
		
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
		
		c.save();
		c.globalAlpha = (m.immuneCycle < m.cycle) ? 1 : 0.5 //|| (m.cycle % 40 > 20)
		c.translate(m.pos.x, m.pos.y);

		c.rotate(m.angle);
		c.beginPath();
		c.arc(0, 0, 30, 0, 2 * Math.PI);
		c.fillStyle = m.bodyGradient;
		c.fill();
		c.beginPath();
		const arc = 0.7 + 0.17 * Math.sin(m.cycle * 0.012)
		c.arc(0, 0, 30, -arc, arc, true); //- Math.PI / 2
		c.strokeStyle = "#445";
		c.lineWidth = 2;
		c.stroke();

		c.beginPath();
		c.moveTo(13, 0)
		c.lineTo(20, 0)
		c.lineWidth = 5;
		c.strokeStyle = "#445";
		c.stroke();

		c.restore();
		c.restore();
		requestAnimationFrame(mapLoop);
	}
	
	mapLoop();	
	
	dragElement(mapDiv);

	function dragElement(elmnt) {
		var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
		if (document.getElementById(elmnt.id + "header")) {
			document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
		} else {
			elmnt.onmousedown = dragMouseDown;
		}

		function dragMouseDown(e) {
			e = e || window.event;
			e.preventDefault();
			pos3 = e.clientX;
			pos4 = e.clientY;
			document.onmouseup = closeDragElement;
			document.onmousemove = elementDrag;
		}

		function elementDrag(e) {
			e = e || window.event;
			e.preventDefault();
			pos1 = pos3 - e.clientX;
			pos2 = pos4 - e.clientY;
			pos3 = e.clientX;
			pos4 = e.clientY;
			
			var newTop = elmnt.offsetTop - pos2;
			var newLeft = elmnt.offsetLeft - pos1;

			if (newTop < 0) {
				newTop = 0; 
			}
			if (newLeft < 0) {
				newLeft = 0; 
			}
			var windowWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
			var windowHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
			var mapDivWidth = elmnt.offsetWidth;
			var mapDivHeight = elmnt.offsetHeight;

			if (newTop + mapDivHeight > windowHeight) {
				newTop = windowHeight - mapDivHeight;
			}
			if (newLeft + mapDivWidth > windowWidth) {
				newLeft = windowWidth - mapDivWidth;
			}

			elmnt.style.top = newTop + "px";
			elmnt.style.left = newLeft + "px";
		}

		function closeDragElement() {
			document.onmouseup = null;
			document.onmousemove = null;
		}
	}
})();
