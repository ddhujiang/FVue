我们平时在使用vue的时候，经常会new 一个vue实例，你知道它具体进行了那些操作吗？

> 其实在new Vue()之后，vue会调用进行初始化，会初始化生命周期、事件、props、methods、data、computed与watch等。其中最重要的是通过Object.defineProperty设置setter与getter,用来实现响应式以及依赖收集。
> 初始化之后调用$mount 挂载组件

接下来，我们主要从下面是两个方向，来仿写一个vue框架

![img](https://pic4.zhimg.com/80/v2-f451d8e74c1d485e6c21e7469d30e217_720w.jpg)

## 一、响应式系统

> 当属性的值改变时，是如何触发视图更改的

我们Vue2用的`defineProperty`实现的数据响应，基于发布订阅模式，其主要包含三部分：`Observer、Dep、Watcher`。

一、Observer进行数据的遍历，利用Object.defineProperty()进行数据的劫持。但数据不止一种类型，所以需要进行递归判断

```
    //判断data是否是对象，是对象则遍历
    observe(value) {
      if (!value || typeof value !== "object") {
        return;
      }

      // 遍历该对象
      Object.keys(value).forEach(key => {
        this.defineReactive(value, key, value[key]);
      });
    }

    // 数据响应化
    defineReactive(obj, key, val) {
      //递归解决数据嵌套
      this.observe(val);
      const dep = new Dep();

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

```

二、Watcher 监听器

监听订阅数据data的属性，但它是怎样和Observe联系起来的呢？奥秘就在这行代码

```
 this.vm[this.key]; // 触发getter，添加依赖

```

读取vue实例上的属性，在这之前`data`下的属性已经被我们劫持为访问器属性了，那这就表明我们能触发对应属性的`get`函数，那这就与`observer`产生了关联，那既然如此，那在触发`get`函数的时候能不能把触发者`Watch`给收集起来呢？此时就得需要一个桥梁`Dep`来协助了。

```
 //Watcher 监听器
  class Watcher {
    constructor(vm, key, cb) {
      this.vm = vm;
      this.key = key;
      this.cb = cb;
      // 将当前watcher实例指定到Dep静态属性target
      Dep.target = this;
      this.vm[this.key]; // 触发getter，添加依赖
      Dep.target = null;
    }

    update() {
      console.log("属性更新了");
      //执行new Watcher传递过来的回调函数，即data值改变时，需要执行的函数。
      this.cb.call(this.vm, this.vm[this.key]);
    }
  }
```

三、 Dep：用来管理watcher

思路应该是`data`下的每一个属性都有一个唯一的`Dep`对象，在`get`中收集仅针对该属性的依赖，然后在`set`方法中触发所有收集的依赖

```
class Dep {
    constructor() {
      // 这里存放每个依赖的1个或多个watcher
      this.deps = [];
    }
    // 在deps中添加一个监听器对象
    addDep(dep) {
      this.deps.push(dep);
      console.log('jjjjjjjjj', this.deps)
    }
    // 通知所有依赖去更新视图
    notify() {
      this.deps.forEach(dep => dep.update());
    }
  }

```

**存在的问题**

现在简易的响应式系统已经实现了，但它还是存在一定问题的。比如我们直接给对象添加新的属性是监听不到了，修改数组的元素值也是如此

1. 对于对象：`Vue`中提供了`Vue.set`和`vm.$set`这两个方法供我们添加新的属性，其原理就是先判断该属性是否为响应式的，如果不是，则通过`defineReactive`方法将其转为响式。
2. 对于数组：直接使用下标修改值还是无效的，`Vue`只`hack`了数组中的七个方法：`pop','push','shift','unshift','splice','sort','reverse'`，使得我们用起来依旧是响应式的。其原理是：在我们调用数组的这七个方法时，`Vue`会改造这些方法，它内部同样也会执行这些方法原有的逻辑，只是增加了一些逻辑：取到所增加的值，然后将其变成响应式，然后再手动出发`dep.notify()`

但直接通过下标修改数组的元素，还是无法实现响应式。

## 二、编译Compile

vue 的模板语句html 根本就不能识别，所以需要通过编译解析一些特殊的指令，如v-if、v-model(双向绑定) 等。编辑的过程可以进行依赖收集，让数据模式和视图之间产生了联系。以后数据模式发生变化了，就可以通知视图更新。

对于特殊指令的解析，主要是利用正则表达式。我们主要看下v-model的解析，其它指令的解析可以直接看代码

把v-model放在inpute上，在编译的时候会解析v-model，把v-model所属的元素上添加一个事件监听，inpute变化的时候，就可以把最新的值设置到vue的实例上，vue实例已经实现了数据响应化，它的响应化的set函数会通知所有的依赖去做更新。

```
   //   双绑
    model(node, vm, exp) {
        // 指定input的value属性
        this.update(node, vm, exp, "model");

        // 视图对模型响应
        node.addEventListener("input", e => {
            vm[exp] = e.target.value;
        });
    }

    modelUpdater(node, value) {
        node.value = value;
    }
```