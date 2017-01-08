// @flow

import * as _ from '../libs/underscore'
import * as d3 from '../libs/d3.v4'
import owid from '../owid'
import dataflow from './owid.dataflow'
import Bounds from './bounds'
import { h, render, Component } from 'preact'
import { observable, computed, asFlat } from 'mobx'

export type ChoroplethData = {
    [key:string]: {
        color: string,
        highlightFillColor: string,
        value: number,
        year: number
    }
};

export type MapProjection = 'World' | 'Africa' | 'N.America' | 'S.America' | 'Asia' | 'Europe' | 'Australia';

export default class ChoroplethMap extends Component {
    props: {
        bounds: Bounds,
        choroplethData: ChoroplethData
    }

    subunits: any

    @observable props = asFlat({})

    @computed get geoData() {
        return topojson.feature(owid.data.world, owid.data.world.objects.world).features.filter(function(feature) {
            return feature.id !== "ATA";
        });
    }

    @computed get path() {
        return App.Views.Chart.Map.Projections[this.props.projection]().path;        
    }

    render() {
        const { bounds, choroplethData, defaultFill } = this.props
        const { geoData, path } = this

        return <g class="map" clip-path="url(#boundsClip)">
            <defs>
                <clipPath id="boundsClip">
                    <rect {...bounds}></rect>
                </clipPath>
            </defs>
            <rect {...bounds} fill="#ecf6fc"></rect>
            <g class="subunits" ref={g => this.subunits = g}>    
                {_.map(geoData, (d) => {
                    const fill = choroplethData[d.id] ? choroplethData[d.id].color : defaultFill
                    return <path d={path(d)} stroke-width={0.3} stroke="#4b4b4b" cursor="pointer" fill={fill}/>
                })}            
            </g>
            <text class="disclaimer" x={bounds.left+bounds.width-5} y={bounds.top+bounds.height-10} font-size="0.5em" text-anchor="end">
                Mapped on current borders
            </text>
        </g>
    }

    componentDidMount() {
        this.componentDidUpdate()
    }

    componentDidUpdate() {
        this.resize()       
    }

    resize() {
        const { bounds, projection } = this.props
        const bbox = this.subunits.getBBox()

        var viewports = {
            "World": { x: 0.525, y: 0.5, width: 1, height: 1 },
            "Africa": { x: 0.48, y: 0.70, width: 0.21, height: 0.38 },
            "N.America": { x: 0.49, y: 0.40, width: 0.19, height: 0.32 },
            "S.America": { x: 0.52, y: 0.815, width: 0.10, height: 0.26 },
            "Asia": { x: 0.49, y: 0.52, width: 0.22, height: 0.38 },
            "Australia": { x: 0.51, y: 0.77, width: 0.1, height: 0.12 },
            "Europe": { x: 0.54, y: 0.54, width: 0.05, height: 0.15 },
        };

        var viewport = viewports[projection];

        // Calculate our reference dimensions. All of these values are independent of the current
        // map translation and scaling-- getBBox() gives us the original, untransformed values.
        var mapX = bbox.x + 1,
            mapY = bbox.y + 1,
            viewportWidth = viewport.width*bbox.width,
            viewportHeight = viewport.height*bbox.height;

        // Calculate what scaling should be applied to the untransformed map to match the current viewport to the container
        var scale = Math.min(bounds.width/viewportWidth, bounds.height/viewportHeight);

        // Work out how to center the map, accounting for the new scaling we've worked out
        var newWidth = bbox.width*scale,
            newHeight = bbox.height*scale,
            boundsCenterX = bounds.left + bounds.width/2,
            boundsCenterY = bounds.top + bounds.height/2,
            newCenterX = mapX + (scale-1)*bbox.x + viewport.x*newWidth,
            newCenterY = mapY + (scale-1)*bbox.y + viewport.y*newHeight,
            newOffsetX = boundsCenterX - newCenterX,
            newOffsetY = boundsCenterY - newCenterY;

        var matrixStr = "matrix(" + scale + ",0,0," + scale + "," + newOffsetX + "," + newOffsetY + ")";
        d3.select(this.subunits).attr('transform', matrixStr);        
    }
}


;(function(d3) {
    "use strict";
    owid.namespace("owid.view.map");

    owid.view.map = function() {
        var map = owid.dataflow();

        map.requires('containerNode', 'bounds', 'colorData', 'defaultFill');

        map.defaults({ 
            projection: 'World',
            onHover: _.noop,
            onHoverStop: _.noop,
            onClick: _.noop
        });

        map.flow('geo : subunits, geoData, path', function(subunits, geoData, path) {            
            subunits.selectAll('path').remove();
            var geoUpdate = subunits.selectAll('path').data(geoData);

            return geoUpdate.enter()
              .append('path')
              .attr('d', path)
              .style('stroke-width', 0.3)
              .style('stroke', '#4b4b4b')
              .style('cursor', 'pointer')
              .merge(geoUpdate);
        });

        // Apply the choropleth!
        map.flow('geo, colorData, defaultFill', function(geo, colorData, defaultFill) {
            geo.style('fill', function(d) { 
                var datum = colorData[d.id];
                return datum ? datum.color : defaultFill;
            });
        });

        // Scaling
        map.flow('subunitsBBox : subunits, geo', function(subunits, geo) {
        });
        map.flow('subunits, subunitsBBox, bounds, projection', function(subunits, bbox, bounds, projection) {

        });

        // Event binding
        map.flow('geo, onHover, onHoverStop, onClick', function(geo, onHover, onHoverStop, onClick) {
            geo.on('mouseenter', onHover);
            geo.on('mouseleave', onHoverStop);
            geo.on('click', onClick);
        });

        map.beforeClean(function() {
            if (map.g) map.g.remove();
        });

        return map;
    };
})(d3v4);