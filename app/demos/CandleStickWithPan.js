import React, { Component } from 'react';
import { PanResponder, TouchableOpacity, View, Text, Dimensions,  ScrollView, StyleSheet } from 'react-native';

import Svg, { G, Text as SvgText, Rect, Path } from 'react-native-svg';
import StaticContainer from 'react-static-container';

import * as d3Scale from 'd3-scale';

import T from '../components/T';


const deviceWidth = Dimensions.get('window').width;
const barMargin = 1; // 1 on each side
const defaultStockChartHeight = 200;
const barWidth = 5;


class CandleStickWithPan extends Component {
  constructor(props) {
    super(props);
    this.state = {
      data: {},
      showGridline: false,
      offset: 0,
      dragging: false
    };
    this._previousOffset = 0;
  }

  componentWillMount() {
    this._panResponder = PanResponder.create({
      onStartShouldSetPanResponder: this._handleStartShouldSetPanResponder,
      onMoveShouldSetPanResponder: this._alwaysTrue,
      onPanResponderGrant: this._alwaysTrue,
      onPanResponderMove: this._handlePanResponderMove,
      onPanResponderRelease: this._handlePanResponderEnd,
      onPanResponderTerminate: this._handlePanResponderEnd
    });
  }


  componentDidMount() {
    this.getStockQuotes();
  }

  getSvgWidth() {
    return deviceWidth * 3;
  }

  setCurrentItem = (i) => {
    if (i <= this.state.data.o.length - 1) {
      this.setState({ current: i });
    }
  }

  getItemByIndex = (i) => {
    const { c, h, l, o, t, v, s } = this.state.data;
    return {
      c: c[i],
      h: h[i],
      l: l[i],
      o: o[i],
      t: new Date(t[i] * 1000),
      v: v[i],
      s,
      color: o[i] <= c[i] ? 'rgb(210, 72, 62)' : 'rgb(28, 193, 135)'
    };
  }

  getStockQuotes = () => {
    const d = new Date();
    const today = new Date(`${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`).getTime();
    const from = today + 86400 * 1000;
    const to = from - 86400 * 30 * 1000;
    const url = `http://m.cnyes.com/api/v1/charting/history?symbol=tse:2330&from=${Math.floor(from / 1000)}&to=${Math.floor(to / 1000)}&resolution=D`;
    fetch(url)
      .then(rsp => rsp.json())
      .then(data => {
        this.setState({ data, current: 0 });
      });
  }

  getLinearScale(domain, range, isTime = false) {
    return (isTime ? d3Scale.scaleTime() : d3Scale.scaleLinear()).domain(domain).range(range);
  }

  loadMore = () => {
    const { nextTime } = this.state.data;
    const to = (nextTime * 1000 - 86400 * 30 * 1000) / 1000;
    if (nextTime) {
      const url = `http://m.cnyes.com/api/v1/charting/history?symbol=tse:2330&from=${nextTime}&to=${Math.floor(to)}&resolution=D`;
      fetch(url)
        .then(rsp => rsp.json())
        .then(data => {
          const originData = this.state.data;
          const newData = {
            ...originData,
            ...data,
            c: [...originData.c, ...data.c],
            h: [...originData.h, ...data.h],
            l: [...originData.l, ...data.l],
            o: [...originData.o, ...data.o],
            t: [...originData.t, ...data.t],
            v: [...originData.v, ...data.v],
          };
          this.setState({ data: newData });
        });
    }
  }

  _handlePanResponderMove = (e, gestureState) => {
    const { dx } = gestureState;
    const newOffset = Math.max(this._previousOffset + dx, 0);
    if (newOffset !== this.state.offset) {
      this.setState({ offset: newOffset });
    }
  }

  // show the cross line
  _handleStartShouldSetPanResponder = (e, gestureState) => {
    const { locationX } = e.nativeEvent;
    const current = Math.floor((deviceWidth - locationX + this.state.offset) / (barWidth + 2 * barMargin));
    this.setCurrentItem(current);
    this.setState({ dragging: true });
    return true;
  }

  _handlePanResponderEnd = (e, gestureState) => {
    this._previousOffset = Math.max(this._previousOffset + gestureState.dx, 0);
    this.setState({ dragging: false });
  }

  _alwaysTrue = () => true

  toggleGridline = () => {
    this.setState({ showGridline: !this.state.showGridline });
  }

  render() {
    const { current, offset } = this.state;
    const { c, h, l, o, t, s } = this.state.data;
    if (s === undefined) {
      return null;
    }
    const highestPrice = Math.max(...h);
    const lowestPrice = Math.min(...l);
    const priceScale = this.getLinearScale([lowestPrice, highestPrice], [0, defaultStockChartHeight].reverse());
    // const svgWidth = Math.max(deviceWidth, c.length * (barWidth + 2 * barMargin));
    const svgWidth = this.getSvgWidth();

    return (
      <ScrollView style={styles.container}>
        <T heading>CandleStick chart</T>
        <Text>{`時間: ${new Date(t[current] * 1000)}`}</Text>
        <View style={{ flexDirection: 'row' }}>
          <Text style={{ flex: 1 }}>{`收盤: ${c[current]}`}</Text>
          <Text style={{ flex: 1 }}>{`開盤: ${o[current]}`}</Text>
          <Text style={{ flex: 1 }}>{`最高: ${h[current]}`}</Text>
          <Text style={{ flex: 1 }}>{`最低: ${l[current]}`}</Text>
        </View>
        <Svg
          height={defaultStockChartHeight}
          width={svgWidth}
          viewBox={`${svgWidth - deviceWidth - offset} 0 ${deviceWidth} ${defaultStockChartHeight}`}
          preserveAspectRatio="xMaxYMin meet"
        >
          <G {...this._panResponder.panHandlers}>
            <Rect x="0" y="0" height={defaultStockChartHeight} width={svgWidth} fill="#efefef" x={offset * -1} />
            <StaticContainer shouldUpdate={!this.state.dragging}>
              <G>
              {
                !this.state.dragging &&
                t.map((_, i) => {
                  const item = this.getItemByIndex(i);
                  const [scaleO, scaleC, yTop, yBottom] = [item.o, item.c, item.h, item.l].map(priceScale);
                  // deviceWidth divided columns each has (barWidth + 2) width
                  // leave 1 as the padding on each side
                  // const x = deviceWidth - i * (barWidth + 2) - barWidth;
                  const x = deviceWidth - barWidth * (i + 1) - barMargin * (2 * i + 1);
                  const barHeight = Math.max(Math.abs(scaleO - scaleC), 1); // if open === close, make sure chartHigh = 1
                  return (
                    <G
                      key={i}
                    >
                      <Rect
                        x={x}
                        y={Math.min(scaleO, scaleC)}
                        fill={item.color}
                        height={barHeight}
                        width={barWidth}
                      />
                      <Path stroke={item.color} d={`M${x + barWidth / 2} ${yTop} ${x + barWidth / 2} ${yBottom}`} strokeWidth="1" />
                      {current === i &&
                        <Path stroke="#666" d={`M${x + barWidth / 2} 0 ${x + barWidth / 2} ${defaultStockChartHeight}`} strokeWidth="0.5" />}
                      {current === i &&
                        <Path stroke="#666" d={`M0 ${scaleC} ${deviceWidth} ${scaleC}`} strokeWidth="0.5" />
                      }
                    </G>
                  );
                })
              }
              {
                this.state.showGridline &&
                priceScale.ticks(10).map((p, i) => {
                  return (
                    <G key={i}>
                      <SvgText
                        fill="#999"
                        textAnchor="end"
                        x={deviceWidth - 5}
                        y={priceScale(p) - 6}
                        fontSize="10"
                      >
                        {`${p}`}
                      </SvgText>
                      <Path d={`M0 ${priceScale(p)} ${deviceWidth - 25} ${priceScale(p)}`} stroke="#ddd" strokeWidth="1" />
                    </G>
                  );
                })
              }
              </G>
            </StaticContainer>
          </G>
        </Svg>
        <View style={{ padding: 15, flexDirection: 'row' }}>
          <TouchableOpacity style={styles.button} onPress={this.toggleGridline}>
            <Text>toggle grid line</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={this.loadMore}>
            <Text>load more</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  button: {
    borderWidth: 1,
    borderColor: '#666',
    borderStyle: 'solid',
    padding: 10,
    marginRight: 10
  }
});

export default CandleStickWithPan;
