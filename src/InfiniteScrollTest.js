import React, {useState, useEffect} from "react";
import { render } from "react-dom";
import InfiniteScroll from "react-infinite-scroll-component";

const style = {
  height: 30,
  border: "1px solid green",
  margin: 6,
  padding: 8
};

const InfiniteScrollTest = () => {
    const [items, setItems] = useState([]);

    const fetchMoreData = () => {
        console.log('fetchMoreData');
        // a fake async api call like which sends
        // 20 more records in 1.5 secs
        setTimeout(() => {
            setItems(items.concat(Array.from({ length: 20 })));
        }, 1500);
    };

    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
      console.log(`initialized: ${initialized}`);
      if (!initialized){
        setInitialized(true);
        setTimeout(() => {
          setItems(Array.from({ length: 20 }));
        }, 2000);
      };
    });

    return (
      <div>
        <h1>demo: react-infinite-scroll-component</h1>
        <hr />
        <InfiniteScroll
          dataLength={items.length}
          next={fetchMoreData}
          hasMore={true}
          loader={<h4>Loading...</h4>}
        >
          {items.map((i, index) => (
            <div style={style} key={index}>
              div - #{index}
            </div>
          ))}
        </InfiniteScroll>
      </div>
    );
}

export default InfiniteScrollTest;