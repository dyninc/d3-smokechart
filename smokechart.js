function SmokeChart(locator,w,h,mx,my) {
	this.parentNode = d3.select(locator);
	
	var htmlid = this.parentNode.attr("id") || locator.replace(/[^a-zA-Z]+/g, '');
	var vis = this.parentNode.append("div").attr('class', 'svg')
		.append("svg").attr("id", htmlid + "-svg")
		.attr("width", w)
		.attr("height", h);

	var xscale = d3.scale.linear().domain([0,mx]).range([0, w]);
	var yscale = d3.scale.linear().domain([0,my+10]).range([h, 0]);
	
	var x1 = xscale(1);
	var dxfunc = function(d) { return xscale(d.x) };
	var dy0func = function(d) { return isNaN(d.y) ? h*5 : yscale(d.y0); };
	var dyfunc = function(d) { return isNaN(d.y) ? h*5 : yscale(d.y+d.y0)};
	
	
	var lines = {};
	var labels = [];
	
	this.selectAll = function(locator) {
		return vis.selectAll(locator);
	};
	
	this.height = function(num) {
		var ret_h = vis.attr('height');
		if (typeof num != undefined) {
			vis.attr('height', num)
		}
		return ret_h;
	};
	
	var yaxis;
	this.yaxis = function(orient,pad,ticks) {
		xscale = d3.scale.linear().domain([0,mx]).range([pad, w]);
		yaxis = d3.svg.axis().scale(yscale).ticks(ticks).tickSubdivide(1).orient(orient);
		
		vis.append("svg:g")
		   .attr("class", "y axis")
		   .attr("transform", "translate(" + pad + ",0)")
		   .call(yaxis);
		
		return this;
	}
	
	this.stretch = function(new_h,new_my) {
		var add_h = vis.attr('height') - h;
		if (!new_h) new_h = h;
		if (my != new_my || new_h != h) {
			vis.attr("height", new_h+add_h);
			yscale.domain([0, new_my+10]).range([new_h,0]);
			if (yaxis) this.selectAll(".y.axis").call(yaxis);
			h = new_h;
			my = new_my;
		}
		
		return this;
	};
	
	this._intensity = 0.6;
	this._layout = function (src) {
		var source = d3.transpose(src);
		var data = [];
		var intensity = this._intensity;
		var half_length = source.length / 2;
		source.forEach(function(d, i){
			var tmp = [];
			d.forEach(function(value,j){
				tmp.push({ x:j, y:value }, { x:j+.9, y:value});
			});
			if (i) {
				// i is 1..x here where x = source length
				// basically comparing abs(i - x/2)  maxdistance x/2-1
				var distance = Math.abs(i - half_length);  // i=1234   hl=1.5 0.5 0.5 1.5
				var percent = (distance + 1) / half_length; // 1 .3333 .3333 1
				tmp[0].c = percent;
				tmp[0].o = (1 - percent/2) * intensity;
			} else {
				tmp[0].c = .0;
				tmp[0].o = .0;
			}
			data.push(tmp);
		});
		return d3.layout.stack()(data);
	};

	this._line_data = function(data) {
		var middle1 = Math.floor(data.length/2);
		var mid_data = data[middle1];
		if (Math.abs(middle1 - data.length/2) < 0.01) {
			data[middle1 - 1].forEach(function(d,i){
				mid_data[i].y0 = (mid_data[i].y0+d.y0)/2;
			});
		}
		return mid_data;
	};

	var area = d3.svg.area().x(dxfunc).y0(dy0func).y1(dyfunc);
	var line = d3.svg.line().x(dxfunc).y(dyfunc)
	
	this.addLine = function(line_class,data,color,smoke) {
		if (typeof smoke == 'undefined') smoke = '#999';
		var color = d3.interpolateRgb(color, smoke);
		var data0 = this._layout(data);
		if (data0.length > 2) {
			var area_class = line_class + '-area';
			this.selectAll("path.area."+area_class)
				.data(data0).enter()
				.append("path").attr("class", "area " + area_class)
				.style("fill", function(d) { return  color(d[0].c); })
				.style("opacity", function(d) { return d[0].o; })
				.attr("d", area);
		}
		this.selectAll("path.line."+line_class)
			.data([this._line_data(data0)]).enter()
			.append("path").attr("class", "line " + line_class)
			.style("stroke",color(0))
			.attr("d", line);
		return this;
	};
	
	this.updateLine = function(line_class,data) {
		var d0 = this._layout(data);
		var area_class = line_class + '-area';
		// you can remove smoke from some chart but you cannot add it,
		// 0 values should be provided to addLine if you start without smoke
		if (d0.length > 2) {
			d3.selectAll("path.area."+area_class)
				.data(d0).attr("d", area);
		} else {
			d3.selectAll("path.area."+area_class).style('opacity', '0'); 
		}
		this.selectAll("path.line."+line_class)
			.data([this._line_data(d0)]).attr("d", line);
		return this;
	};
	
	this.addGuide = function(name,number,color) {
		var data = d3.range(mx).map(function(){return [number]});
		this.addLine(name,data,color);
		d3.selectAll("path.line."+name).attr('class', 'guide');
		return this;
	};
	
	this.updateGuide = function(name,number) {
		var data = d3.range(mx).map(function(){return [number]});
		this.updateLine(name,data);
		return this;
	};
	
	this.labelCount = 0;
	this.showLabels = function(labels) {
		var dx2 = x1/2;
		var len = labels.length;

		if (len != this.labelCount) {
			this.selectAll("text.label").remove();
			this.labelCount = 0;
			if (!len) return;
			if (!this.labelCount) this.height(h+20);
		}

		if  (this.labelCount) {
			// update existing
			this.selectAll("text.label")
				.data(labels)
				.text(String);
		} else {
			// create
			this.selectAll("text.label")
				.data(labels).enter()
				.append("text").attr("class", "label")
				.attr("x", function (v,i) { return dx2 + i * w / len } )
				.attr("y", h+20)
				.attr("text-anchor", "middle")
				.text(String);
		}
		
		this.labelCount = len;
		
		return this;
	};
	
	this.errors = this.selectAll("circle.errors");
	this.showMarkers = function(xline) {
		if (!this.errors.empty()) this.errors.remove();
		var data = [];
		var prev = -1;
		var cnt = 0;
		xline.forEach(function(v,i){if (prev != v) {cnt=0;prev=v} data.push([v,cnt++]) });
		
		var rad = h/500+1.1
		
		this.errors = this.selectAll("circle.errors")
				.data(data).enter()
				.append("circle")
				.attr("class", "errors")
				.attr("cx", x1/2)
				.attr("r", rad)
				.style("fill", "red")
				.style("stroke", "none")
				.attr("transform", function(d) { return "translate(" + xscale(d[0]) + "," + (h/300+1+(rad+1.5)*d[1]) + ")"; });
		return this;
	};

	this.avlCount = 0;
	this.showAvailability = function(percents,height) {
		if (typeof height == 'undefined') height = 50;
		
		var shift = 2;
		var mod = height/100;
		var len = this.avlCount = percents.length;
		var wl = w/len;
		var wi = x1*mx/len-5;
		
		var xf = function(v,i) {return i*wl}
		var hf = function(v,i){ return Math.floor((100-v)*mod+0.9) };
		
		this.selectAll("rect.unavailable")
			.data(percents).enter()
			.append("rect").attr("class", "unavailable")
			.attr("x", xf )
			.attr("width", wi)
			.attr("height", function(v,i){var dummy=hf(v); return dummy > 0 && dummy < 3 ? 3 : dummy; })
			.attr("y", h+shift);
		this.selectAll("rect.available")
			.data(percents).enter()
			.append("rect").attr("class", "available")
			.attr("x", xf )
			.attr("width", wi)
			.attr("height", function (v){return hf(99-v)})
			.attr("y", function(v){var dummy=hf(v); if(dummy > 0 && dummy < 1.5) dummy=1.5; return h+dummy+shift})
			.append("text");
		this.selectAll("text.avlpercent")
			.data(percents).enter()
			.append("text").attr('class','avlpercent')
			.attr("x", function (v,i) { return xf(v,i)+wi/2 } )
			.attr("y", function (v) { return h+height/2+2 })
			.attr("text-anchor", "middle")
			.text(String);
		return this;
	};

	return this;
};


FlameChart = function(locator,w,h,mx,my) {
	fc = SmokeChart(locator,w,h,mx,my);
	fc._intensity = .8;
	fc._line_data = function(data) {
		return data[0]
	};
	fc._layout = function (src) {
		var source = d3.transpose(src);
		var data = [];
		var intensity = this._intensity;
		var ml = source.length;
		source.forEach(function(d, i){
			var tmp = [];
			d.forEach(function(value,j){
				tmp.push({ x:j, y:value }, { x:j+.9, y:value});
			});
			if (i) {
				var percent = (i+1) / ml;
				tmp[0].c = percent;
				tmp[0].o = Math.pow(percent, 1.5) * intensity;
			} else {
				tmp[0].c = .0;
				tmp[0].o = .0;
			}
			data.push(tmp);
		});
		return d3.layout.stack()(data);
	};
	return fc;
};

