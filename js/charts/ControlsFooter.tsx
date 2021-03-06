import * as _ from 'lodash'
import * as d3 from 'd3'
import Bounds from './Bounds'
import Text from './Text'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { observable, computed, asFlat, autorun, autorunAsync, action } from 'mobx'
import {observer} from 'mobx-react'
import * as Cookies from 'js-cookie'
import ChartConfig from './ChartConfig'
import * as $ from 'jquery'
import EntitySelect from './owid.view.entitySelect'

declare const Global: any
declare const App: any

@observer
class EmbedMenu extends React.Component<{ embedUrl: string }, null> {
    render() {
        const {embedUrl} = this.props

        return <div className="embedMenu" onClick={(evt) => evt.stopPropagation()}>
            <h2>Embed</h2>
            <p>Paste this into any HTML page:</p>
            <textarea onFocus={function(evt: any) { evt.target.select(); }}>
                {`<iframe src="${embedUrl}" style="width: 100%; height: 600px; border: 0px none;"></iframe>`}
            </textarea>
        </div>
    }
}

interface ShareMenuProps {
    chart: ChartConfig,
    chartView: any,
    onDismiss: () => void
}

@observer
class ShareMenu extends React.Component<ShareMenuProps, null> {
    @computed get title() : string {
        return document.title.replace(" - Our World In Data", "")
    }

    @computed get baseUrl() : string {
        return Global.rootUrl + '/' + this.props.chart.slug
    }

    @computed get queryStr() : string {
        return this.props.chartView.url.lastQueryStr||""
    }

    @computed get editUrl() : string {
        return Cookies.get('isAdmin') ? (Global.adminRootUrl + '/charts/' + this.props.chartView.model.get('id') + '/edit') : null
    }

    @observable isEmbedMenuActive : boolean = false

    embedMenu: any

    componentDidMount() {
        setTimeout(() => {
            d3.select(window).on('click.shareMenu', () => {
                this.props.chartView.removePopup(EmbedMenu)

                if (this.props.onDismiss)
                    this.props.onDismiss()
            })
        }, 50)
    }

    componentWillUnmount() {
        d3.select(window).on('click.shareMenu', null)
    }

    @action.bound onEmbed() {
        this.props.chartView.addPopup(<EmbedMenu embedUrl={this.baseUrl+this.queryStr}/>)
    }

    render() {
        const {title, baseUrl, queryStr, editUrl, isEmbedMenuActive} = this

        return <div className="shareMenu" onClick={(evt) => evt.stopPropagation()}>
            <h2>Share</h2>
            <a className="btn" target="_blank" title="Tweet a link" href={"https://twitter.com/intent/tweet/?text=" + encodeURIComponent(title) + "&url=" + encodeURIComponent(baseUrl+queryStr)}>
                <i className="fa fa-twitter"/> Twitter
            </a>
            <a className="btn" target="_blank" title="Share on Facebook" href={"https://www.facebook.com/dialog/share?app_id=1149943818390250&display=page&href=" + encodeURIComponent(baseUrl+queryStr)}>
                <i className="fa fa-facebook"/> Facebook
            </a>
            <a className="btn" title="Embed this visualization in another HTML document" onClick={this.onEmbed}>
                <i className="fa fa-code"/> Embed
            </a>
            {editUrl && <a className="btn" target="_blank" title="Edit chart" href={editUrl}>
                <i className="fa fa-edit"/> Edit
            </a>}
        </div>
    }
}

interface ControlsFooterProps {
    chart: ChartConfig,
    activeTabName: string,
    chartView: any,
    availableTabs: string[],
    onTabChange: (tabName: string) => void
}

class HighlightToggle extends React.Component<{ chart: ChartConfig }, undefined> {
    @computed get chartView() { return window.chart }
    @computed get chart() { return this.props.chart }
    @computed get highlight() { return this.chart.highlightToggle }

    @computed get highlightParams() {
        return owid.getQueryParams((this.highlight.paramStr||"").substring(1))
    }

    @action.bound onHighlightToggle(e) {
        if (e.target.checked) {
            const params = owid.getQueryParams()
            this.chartView.url.populateFromURL(_.extend(params, this.highlightParams))
        } else {
            this.chart.selectedEntities = []
        }
    }

    get isHighlightActive() {
        const params = owid.getQueryParams()
        let isActive = true
        _.keys(this.highlightParams).forEach((key) => {
            if (params[key] != this.highlightParams[key])
                isActive = false
        })
        return isActive
    }

    render() {
        const {highlight, isHighlightActive} = this
        return <label className="clickable HighlightToggle">
            <input type="checkbox" checked={isHighlightActive} onChange={this.onHighlightToggle}/> {highlight.description}
        </label>
    }
}

@observer
export default class ControlsFooter extends React.Component<ControlsFooterProps, undefined> {
    @computed get tabNames() : string[] {
        return this.props.availableTabs
    }

    @computed get height() {
        const height = Bounds.forText("CHART", { fontSize: 16*this.props.chartView.scale +'px' }).height*2/this.props.chartView.scale
        if (this.props.chartView.isPortrait && this.props.chart.type == App.ChartType.ScatterPlot)
            return height*2
        else
            return height
    }

    @observable isShareMenuActive: boolean = false

    @action.bound onShareMenu() {
        this.isShareMenuActive = !this.isShareMenuActive
    }

    @observable linkUrl: string
    componentDidMount() {
        this.linkUrl = window.location.toString()
        $(window).on('query-change', () => {
            this.linkUrl = window.location.toString()
        })
    }

    entitySelect: EntitySelect = null
    @action.bound onEntitySelect() {
        const unselectedEntities = _.without(this.props.chart.scatterData.validEntities, ...this.props.chart.selectedEntities)
        setTimeout(() => {
            this.entitySelect = EntitySelect()
            this.entitySelect.update({
                containerNode: this.props.chartView.htmlNode,
                entities: unselectedEntities.map(e => ({ name: e }))
            });
        }, 0)
					//entitySelect.afterClean(function() { entitySelect = null; });
    }

    render() {
        const {props, tabNames, isShareMenuActive} = this
        const {chart, chartView} = props
        return <div className="controlsFooter">
            <div className="scatterControls">            
            {chart.type == App.ChartType.ScatterPlot && chartView.activeTabName == 'chart' && 
                    [chart.highlightToggle && <HighlightToggle chart={chart}/>,
                    <button onClick={this.onEntitySelect}>
                        <i class="fa fa-search"/> Search
                    </button>]
            }
            </div>
            <nav className="tabs">
                <ul>
                    {_.map(tabNames, (tabName) => {
                        return <li className={"tab clickable" + (tabName == props.activeTabName ? ' active' : '')} onClick={() => this.props.onTabChange(tabName)}><a>{tabName}</a></li>
                    })}
                    <li className={"tab clickable icon" + (props.activeTabName == 'download' ? ' active' : '')} onClick={() => this.props.onTabChange('download')} title="Download as .png or .svg">
                        <a><i className="fa fa-download"/></a>
                    </li>
                    <li className="clickable icon"><a title="Share" onClick={this.onShareMenu}><i className="fa fa-share-alt"/></a></li>
                    {props.chartView.isEmbed && <li className="clickable icon"><a title="Open chart in new tab" href={this.linkUrl} target="_blank"><i className="fa fa-expand"/></a></li>}
                </ul>
            </nav>
            {isShareMenuActive && <ShareMenu chartView={this.props.chartView} chart={this.props.chart} onDismiss={() => this.isShareMenuActive = false}/>}
        </div>
    }
}
