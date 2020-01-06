  class FVue {
    //options就是我们new FVue 时传递进来的数据
    constructor(options) {
      this.$options = options;
  
      // 数据响应化
      this.$data = options.data;
      this.observe(this.$data);

      // 模拟一下watcher创建
      // new Watcher();
      //读取一下属性，会执行它的get方法
      // this.$data.str;
      new FCompile(options.el,this);

        // created执行
        if (options.created) {
            //所以我们可以在created生命周期中直接使用this
            options.created.call(this);
        }
    }
    
    //判断data是否是对象，是对象则遍历
    observe(value) {
      if (!value || typeof value !== "object") {
        return;
      }
  
      // 遍历该对象
      Object.keys(value).forEach(key => {
        this.defineReactive(value, key, value[key]);
        // 代理data中的属性到vue实例上，即this.key=this.$data.key
        this.proxyData(key);
      });
    }
  
    // 数据响应化
    defineReactive(obj, key, val) {
      //递归解决数据嵌套
      this.observe(val);
      const dep=new Dep();

      Object.defineProperty(obj, key, {
        get() {
          // console.log('get-----------------');
          Dep.target && dep.addDep(Dep.target);
          return val;
        },
        set(newVal) {
          if (newVal === val) {
            return;
          }
          // console.log('set---------------');
          val = newVal;
          dep.notify();
        }
      });
    }

    //代理
    proxyData(key) {
        Object.defineProperty(this, key, {
          //通过this.key访问的其实就是this.$data.key,所以在vue中可以直接访问data的数据
              get(){
                  return this.$data[key]
              },
              set(newVal){
                  this.$data[key] = newVal;
              }
        })
    }
  }
  
  // Dep：用来管理依赖（Watcher）
  class Dep {
    constructor() {
      // 这里存放若干依赖（watcher）
      this.deps = [];
    }
      // 在deps中添加一个监听器对象
    addDep(dep) {
      this.deps.push(dep);
      console.log('jjjjjjjjj',this.deps)
    }
      // 通知所有依赖去更新视图
    notify() {
      this.deps.forEach(dep => dep.update());
    }
  }
  
  // 依赖（Watcher）
  class Watcher {
    constructor(vm,key,cb) {
      this.vm=vm;
      this.key=key;
      this.cb=cb;
      // 将当前watcher实例指定到Dep静态属性target
      Dep.target = this;
      this.vm[this.key]; // 触发getter，添加依赖
      Dep.target = null;
    }
  
    update() {
      console.log("属性更新了");
      //执行new Watcher传递过来的回调函数，即data值改变时，需要执行的函数。
      this.cb.call(this.vm,this.vm[this.key]);
    }
  }
  