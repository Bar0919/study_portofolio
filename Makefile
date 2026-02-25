CC = emcc
CFLAGS = -O3 -std=c++17 --bind \
         -s WASM=1 \
         -s ALLOW_MEMORY_GROWTH=1 \
         -s MODULARIZE=1 \
         -s EXPORT_ES6=1 \
         -s EXPORT_NAME='createModule' \
         -s ENVIRONMENT=web,worker

SOURCES = cpp/main.cpp \
          cpp/engine/denoise_engine.cpp \
          cpp/engine/gmrf.cpp \
          cpp/engine/hgmrf.cpp \
          cpp/engine/lc_mrf.cpp \
          cpp/engine/tv_mrf.cpp \
          cpp/utils/metrics.cpp

OUTPUT = frontend/src/wasm/denoise_module.js
TEST_BINARY = model_tests

all: $(OUTPUT)

$(OUTPUT): $(SOURCES)
	mkdir -p frontend/src/wasm
	$(CC) $(CFLAGS) $(SOURCES) -o $(OUTPUT)

test: $(SOURCES) tests/all_models_test.cpp
	g++ -O3 -std=c++17 tests/all_models_test.cpp \
		cpp/engine/denoise_engine.cpp \
		cpp/engine/gmrf.cpp \
		cpp/engine/hgmrf.cpp \
		cpp/engine/lc_mrf.cpp \
		cpp/engine/tv_mrf.cpp \
		cpp/utils/metrics.cpp \
		-o $(TEST_BINARY)
	./$(TEST_BINARY)

clean:
	rm -rf frontend/src/wasm
	rm -f $(TEST_BINARY)
